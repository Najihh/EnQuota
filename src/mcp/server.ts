/**
 * EnQuota - Model Context Protocol (MCP) Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { detectIsp, normalizePhone } from '../detector.js';
import { defaultSessionManager } from '../session.js';
import { resolveProvider } from '../providers/index.js';

const TOOLS: Tool[] = [
  {
    name: 'telco_detect_isp',
    description: 'Detect Indonesian Telco operator, brand, prefix, and engine compatibility from a phone number (Tri, Indosat, Telkomsel, by.U, XL, AXIS, Smartfren).',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Indonesian phone number (e.g. "089612345678", "+6281234567890", "0851...")'
        }
      },
      required: ['phone']
    }
  },
  {
    name: 'telco_login',
    description: 'Initiate SMS OTP login for an Indonesian SIM card. Automatically detects the ISP from prefix and triggers the OTP request.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Indonesian mobile phone number (e.g. "0896xxxxxxx", "0857xxxxxxx", "0812xxxxxxx")'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional manual ISP provider override (TRI, INDOSAT, TELKOMSEL, BYU)'
        }
      },
      required: ['phone']
    }
  },
  {
    name: 'telco_submit_otp',
    description: 'Submit the 6-digit SMS OTP code to complete authentication and persist the SIM session.',
    inputSchema: {
      type: 'object',
      properties: {
        otp: {
          type: 'string',
          description: 'The 6-digit OTP code received via SMS (or Ruby Token for by.U)'
        },
        phone: {
          type: 'string',
          description: 'Optional phone number associated with the pending login'
        },
        trans_id: {
          type: 'string',
          description: 'Optional transaction ID returned by telco_login'
        }
      },
      required: ['otp']
    }
  },
  {
    name: 'telco_get_profile',
    description: 'Get SIM profile, subscriber name, credit balance, card validity date, and loyalty points (BonsTri, IMPoin, Telkomsel Poin, uCoin).',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Optional phone number of the target account (defaults to active session)'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional ISP provider override'
        }
      }
    }
  },
  {
    name: 'telco_get_quota',
    description: 'Get all active internet, local, app, and roaming quota balances and expiration dates.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Optional phone number of the target account (defaults to active session)'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional ISP provider override'
        }
      }
    }
  },
  {
    name: 'telco_get_packages',
    description: 'Explore and search available internet package catalogs, special CVM promo offers, and toppings.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Optional search keyword (e.g. "freedom", "jajan", "unlimited", "10 gb", "roaming")'
        },
        category: {
          type: 'string',
          description: 'Optional package category filter'
        },
        phone: {
          type: 'string',
          description: 'Optional phone number to check personalized/CVM offers for'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional ISP provider override'
        }
      }
    }
  },
  {
    name: 'telco_buy_package',
    description: 'Purchase an internet package by deducting airtime pulsa balance or generating an instant QRIS payment.',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: {
          type: 'string',
          description: 'Product / Offer ID of the package to buy'
        },
        payment_method: {
          type: 'string',
          enum: ['PULSA', 'QRIS', 'GOPAY', 'DANA', 'SHOPEEPAY', 'OVO'],
          default: 'PULSA',
          description: 'Payment method (default: "PULSA" for auto-deduct)'
        },
        phone: {
          type: 'string',
          description: 'Optional phone number to buy package for'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional ISP provider override'
        }
      },
      required: ['package_id']
    }
  },
  {
    name: 'telco_topup_pulsa',
    description: 'Top-up SIM credit / pulsa balance via official denominations and QRIS.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in IDR to top up (e.g. 10000, 25000, 50000, 100000)'
        },
        payment_method: {
          type: 'string',
          default: 'QRIS',
          description: 'Payment channel (e.g. "QRIS")'
        },
        phone: {
          type: 'string',
          description: 'Optional phone number to top up'
        },
        provider: {
          type: 'string',
          enum: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'],
          description: 'Optional ISP provider override'
        }
      },
      required: ['amount']
    }
  },
  {
    name: 'telco_list_sessions',
    description: 'List all currently active and saved SIM sessions across all telco providers.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'telco_logout',
    description: 'Logout and remove a stored SIM session.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to log out and clear'
        }
      },
      required: ['phone']
    }
  }
];

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'enquota',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'telco_detect_isp': {
          const phone = String(args.phone || '');
          const info = detectIsp(phone);
          return {
            content: [{ type: 'text', text: JSON.stringify(info, null, 2) }]
          };
        }

        case 'telco_login': {
          const phone = String(args.phone || '');
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.login(phone);

          if (result.success && result.extra?.msisdn) {
            // Save initial session state
            const norm = normalizePhone(phone);
            defaultSessionManager.saveSession({
              phone: norm.national,
              msisdn: norm.international,
              provider: provider.provider,
              brand: provider.brand,
              updatedAt: new Date().toISOString()
            }, true);
          }

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_submit_otp': {
          const otp = String(args.otp || '');
          const phone = args.phone ? String(args.phone) : undefined;
          const transId = args.trans_id ? String(args.trans_id) : undefined;

          const { provider } = resolveProvider({ phone });
          const result = await provider.submitOtp(otp, transId, phone);

          if (result.success && result.session) {
            defaultSessionManager.saveSession(result.session, true);
          }

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_get_profile': {
          const phone = args.phone ? String(args.phone) : undefined;
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.getProfile();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_get_quota': {
          const phone = args.phone ? String(args.phone) : undefined;
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.getQuota();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_get_packages': {
          const keyword = args.keyword ? String(args.keyword) : undefined;
          const category = args.category ? String(args.category) : undefined;
          const phone = args.phone ? String(args.phone) : undefined;
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.getPackages(keyword, category);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_buy_package': {
          const packageId = String(args.package_id || '');
          const paymentMethod = args.payment_method ? String(args.payment_method) : 'PULSA';
          const phone = args.phone ? String(args.phone) : undefined;
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.buyPackage(packageId, paymentMethod);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_topup_pulsa': {
          const amount = Number(args.amount || 0);
          const paymentMethod = args.payment_method ? String(args.payment_method) : 'QRIS';
          const phone = args.phone ? String(args.phone) : undefined;
          const providerParam = args.provider ? String(args.provider) : undefined;
          const { provider } = resolveProvider({ phone, provider: providerParam });
          const result = await provider.topupPulsa(amount, paymentMethod);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        case 'telco_list_sessions': {
          const sessions = defaultSessionManager.listSessions();
          return {
            content: [{ type: 'text', text: JSON.stringify({ count: sessions.length, sessions }, null, 2) }]
          };
        }

        case 'telco_logout': {
          const phone = String(args.phone || '');
          const removed = defaultSessionManager.removeSession(phone);
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: removed, message: removed ? `Session for ${phone} cleared.` : `No session found for ${phone}.` }, null, 2) }]
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true
          };
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  });

  return server;
}

export async function runStdioMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('EnQuota MCP Server running on stdio\n');
}
