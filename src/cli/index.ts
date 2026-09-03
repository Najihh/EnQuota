/**
 * EnQuota - Interactive CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import inquirer from 'inquirer';
import { detectIsp, normalizePhone } from '../detector.js';
import { defaultSessionManager } from '../session.js';
import { resolveProvider } from '../providers/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('enquota')
    .description('EnQuota - Unified Indonesian Telco Toolkit & MCP Server')
    .version('1.0.0');

  // --- COMMAND: DETECT ---
  program
    .command('detect')
    .description('Detect ISP, operator, brand, and engine from an Indonesian phone number')
    .argument('<phone>', 'Phone number (e.g. 0896..., 0857..., 0812..., 0851...)')
    .action((phone) => {
      const info = detectIsp(phone);
      const table = new Table({ colWidths: [22, 50] });

      table.push(
        [chalk.cyan('Nomor Ponsel'), chalk.bold.white(info.normalized.national)],
        [chalk.cyan('Format Internasional'), chalk.white(info.normalized.international)],
        [chalk.cyan('Prefix 4 Digit'), chalk.yellow(info.prefix)],
        [chalk.cyan('Provider / Operator'), chalk.bold.green(info.name)],
        [chalk.cyan('Brand Layanan'), chalk.magenta(info.brand)],
        [chalk.cyan('Engine Gateway'), chalk.gray(info.engine)],
        [chalk.cyan('Status Dukungan'), info.isSupported ? chalk.bgGreen.black(' SUPPORTED ') : chalk.bgRed.white(' PLANNED ')]
      );

      console.log(chalk.bold.yellow('\n--- Hasil Deteksi ISP EnQuota ---'));
      console.log(table.toString());
      process.exit(0);
    });

  // --- COMMAND: LOGIN ---
  program
    .command('login')
    .description('Login SIM card via SMS OTP (auto-detects ISP)')
    .argument('<phone>', 'Phone number to login')
    .action(async (phone) => {
      const spinner = ora('Mendeteksi ISP dan mengirim OTP...').start();
      try {
        const { provider } = resolveProvider({ phone });
        spinner.text = `Menghubungkan ke ${provider.name} (${provider.brand})...`;

        const res = await provider.login(phone);
        spinner.stop();

        if (!res.success) {
          console.log(chalk.red(`Gagal login: ${res.message}`));
          process.exit(1);
        }

        console.log(chalk.green(`\n${res.message}`));

        if (res.requireOtp) {
          const { otp } = await inquirer.prompt([
            {
              type: 'input',
              name: 'otp',
              message: 'Masukkan kode OTP yang diterima melalui SMS:',
              validate: (input) => input.trim().length >= 4 ? true : 'Kode OTP tidak valid'
            }
          ]);

          const valSpinner = ora('Memvalidasi kode OTP...').start();
          const valRes = await provider.submitOtp(otp, res.transId, phone);
          valSpinner.stop();

          if (valRes.success && valRes.session) {
            defaultSessionManager.saveSession(valRes.session, true);
            console.log(chalk.bold.green(`\nLogin Berhasil! Sesi tersimpan untuk ${valRes.session.phone} (${provider.brand})`));
            process.exit(0);
          } else {
            console.log(chalk.red(`Validasi gagal: ${valRes.message}`));
            process.exit(1);
          }
        } else {
          process.exit(0);
        }
      } catch (err: any) {
        spinner.stop();
        console.log(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // --- COMMAND: SESSIONS ---
  program
    .command('sessions')
    .description('List all saved SIM card sessions')
    .action(() => {
      const sessions = defaultSessionManager.listSessions();
      if (sessions.length === 0) {
        console.log(chalk.yellow('\nBelum ada sesi SIM tersimpan. Gunakan `enquota login <nomor>` untuk menghubungkan nomor.'));
        process.exit(0);
      }

      const table = new Table({
        head: [chalk.cyan('Nomor'), chalk.cyan('Provider'), chalk.cyan('Brand'), chalk.cyan('Tipe'), chalk.cyan('Diperbarui')],
        colWidths: [16, 16, 16, 14, 26]
      });

      sessions.forEach(s => {
        table.push([
          s.phone || s.msisdn,
          s.provider,
          s.brand,
          s.userType || 'SUBSCRIBER',
          new Date(s.updatedAt).toLocaleString('id-ID')
        ]);
      });

      console.log(chalk.bold.yellow('\n--- Daftar Sesi SIM Tersimpan ---'));
      console.log(table.toString());
      process.exit(0);
    });

  // --- COMMAND: PROFILE ---
  program
    .command('profile')
    .description('Check subscriber profile, credit balance, and loyalty points')
    .option('-p, --phone <phone>', 'Specific phone number to check')
    .action(async (options) => {
      const spinner = ora('Mengambil data profil SIM...').start();
      try {
        const { provider, phone } = resolveProvider({ phone: options.phone });
        const res = await provider.getProfile();
        spinner.stop();

        if (!res.success) {
          console.log(chalk.red(`Gagal: ${res.message}`));
          process.exit(1);
        }

        const table = new Table({ colWidths: [22, 50] });
        table.push(
          [chalk.cyan('Nomor SIM'), chalk.bold.white(res.phone || phone || '-')],
          [chalk.cyan('Provider / Brand'), chalk.bold.green(`${provider.name} (${provider.brand})`)],
          [chalk.cyan('Nama Pelanggan'), chalk.white(res.name || '-')],
          [chalk.cyan('Sisa Pulsa'), chalk.bold.yellow(res.balanceFormatted || `Rp ${res.balance || 0}`)],
          [chalk.cyan('Masa Aktif'), chalk.green(res.activeUntil || '-')],
          [chalk.cyan('Poin Loyalitas'), chalk.magenta(`${res.loyaltyPoints?.name || 'Poin'}: ${res.loyaltyPoints?.points || 0} (${res.loyaltyPoints?.tier || 'Member'})`)]
        );

        console.log(chalk.bold.yellow(`\n--- Profil Akun ${provider.brand} ---`));
        console.log(table.toString());
        process.exit(0);
      } catch (e: any) {
        spinner.stop();
        console.log(chalk.red(`Error: ${e.message}`));
        process.exit(1);
      }
    });

  // --- COMMAND: QUOTA ---
  program
    .command('quota')
    .description('Check active data quotas and validity')
    .option('-p, --phone <phone>', 'Specific phone number to check')
    .action(async (options) => {
      const spinner = ora('Mengambil data kuota internet...').start();
      try {
        const { provider, phone } = resolveProvider({ phone: options.phone });
        const res = await provider.getQuota();
        spinner.stop();

        if (!res.success) {
          console.log(chalk.red(`Gagal: ${res.message}`));
          process.exit(1);
        }

        console.log(chalk.bold.cyan(`\n--- Kuota Internet ${provider.brand} (${res.phone || phone}) ---`));
        console.log(`Ringkasan: ${chalk.bold.green(res.totalRemainingFormatted || 'Aktif')}`);

        if (res.items.length > 0) {
          const table = new Table({
            head: [chalk.cyan('Paket / Allowance'), chalk.cyan('Sisa Kuota'), chalk.cyan('Masa Berlaku')],
            colWidths: [36, 18, 20],
            wordWrap: true
          });
          res.items.forEach(it => {
            table.push([it.name, chalk.yellow(it.remainingFormatted), it.validUntil || '-']);
          });
          console.log(table.toString());
        }
        process.exit(0);
      } catch (e: any) {
        spinner.stop();
        console.log(chalk.red(`Error: ${e.message}`));
        process.exit(1);
      }
    });

  // --- COMMAND: PACKAGES ---
  program
    .command('packages')
    .description('Search and browse available data packages / promo deals')
    .argument('[keyword]', 'Optional keyword to search (e.g. freedom, happy, 30 hari, promo)')
    .option('-p, --phone <phone>', 'Specific phone number to check')
    .action(async (keyword, options) => {
      const spinner = ora('Mengambil katalog paket data...').start();
      try {
        const { provider } = resolveProvider({ phone: options.phone });
        const res = await provider.getPackages(keyword);
        spinner.stop();

        if (!res.success || res.packages.length === 0) {
          console.log(chalk.yellow(`\nTidak ada paket yang ditemukan${keyword ? ` untuk kata kunci '${keyword}'` : ''}.`));
          process.exit(0);
        }

        console.log(chalk.bold.green(`\n=== Paket Tersedia ${provider.brand}${keyword ? ` (Pencarian: ${keyword})` : ''} [${res.packages.length} Paket] ===`));

        const table = new Table({
          head: [chalk.cyan('#'), chalk.cyan('Nama Paket'), chalk.cyan('Harga'), chalk.cyan('Kuota / Benefit'), chalk.cyan('ID Produk')],
          colWidths: [4, 32, 16, 24, 28],
          wordWrap: true
        });

        res.packages.forEach((p, idx) => {
          table.push([
            idx + 1,
            chalk.white(p.name),
            chalk.bold.yellow(p.priceFormatted),
            chalk.green(p.quotaFormatted || p.validityFormatted || '-'),
            chalk.gray(p.id)
          ]);
        });

        console.log(table.toString());
        process.exit(0);
      } catch (e: any) {
        spinner.stop();
        console.log(chalk.red(`Error: ${e.message}`));
        process.exit(1);
      }
    });

  // --- COMMAND: LOGOUT ---
  program
    .command('logout')
    .description('Remove a stored SIM session')
    .argument('<phone>', 'Phone number to log out')
    .action((phone) => {
      const removed = defaultSessionManager.removeSession(phone);
      if (removed) {
        console.log(chalk.green(`\nSesi untuk nomor ${phone} berhasil dihapus dari keystore.`));
      } else {
        console.log(chalk.yellow(`\nTidak ditemukan sesi tersimpan untuk nomor ${phone}.`));
      }
      process.exit(0);
    });

  // --- COMMAND: USAGE / HELP ---
  program
    .command('usage')
    .description('Show full usage guide, command list, and operator prefix matrix')
    .action(() => {
      console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════════════╗'));
      console.log(chalk.bold.cyan('║               EnQuota — Indonesian Telco Toolkit & MCP Server             ║'));
      console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════════════╝'));
      console.log(chalk.gray('Smart ISP Prefix Detection, Quota Checker, Package Explorer & Auto-Buy\n'));

      console.log(chalk.bold.yellow('📱 MATRIKS DETEKSI PREFIX OPERATOR:'));
      console.log('  • Tri (bima+)         : 0895, 0896, 0897, 0898, 0899');
      console.log('  • Indosat (myIM3)     : 0814, 0815, 0816, 0855, 0856, 0857, 0858');
      console.log('  • Telkomsel           : 0811, 0812, 0813, 0821, 0822, 0823, 0852, 0853');
      console.log('  • Telkomsel by.U      : 0851');
      console.log('  • XL Axiata (myXL)    : 0817, 0818, 0819, 0859, 0877, 0878');
      console.log('  • AXIS                : 0831, 0832, 0833, 0838');
      console.log('  • Smartfren           : 0881-0889 (Terdeteksi)\n');

      console.log(chalk.bold.yellow('💻 DAFTAR PERINTAH CLI (COMMANDS):'));
      console.log('  ' + chalk.green('enquota detect <phone>') + '       Deteksi operator & brand dari nomor HP');
      console.log('  ' + chalk.green('enquota login <phone>') + '        Login SIM card via SMS OTP (otomatis simpan sesi)');
      console.log('  ' + chalk.green('enquota quota [-p <phone>]') + '  Cek sisa kuota internet aktif & masa berlaku');
      console.log('  ' + chalk.green('enquota profile [-p <phone>]') + 'Cek profil pelanggan, sisa pulsa & poin loyalitas');
      console.log('  ' + chalk.green('enquota packages [keyword]') + '   Cari & jelajahi katalog paket data / promo CVM');
      console.log('  ' + chalk.green('enquota sessions') + '             Lihat semua sesi SIM yang tersimpan di keystore');
      console.log('  ' + chalk.green('enquota logout <phone>') + '       Hapus sesi SIM dari keystore lokal');
      console.log('  ' + chalk.green('enquota --mcp') + '                Jalankan Stdio MCP Server untuk AI Agent\n');

      console.log(chalk.bold.yellow('🤖 TOOLS MODEL CONTEXT PROTOCOL (MCP):'));
      console.log('  `eq_detect_isp`, `eq_login`, `eq_submit_otp`, `eq_get_profile`, `eq_get_quota`,');
      console.log('  `eq_get_packages`, `eq_buy_package`, `eq_topup_pulsa`, `eq_list_sessions`, `eq_help`\n');

      process.exit(0);
    });

  return program;
}
