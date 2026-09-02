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

  program
    .command('detect')
    .description('Detect ISP and provider from an Indonesian phone number')
    .argument('<phone>', 'Phone number (e.g. 0896..., 0857..., 0812..., 0851...)')
    .action((phone) => {
      const info = detectIsp(phone);
      const table = new Table({ colWidths: [20, 50] });

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

  program
    .command('login')
    .description('Login SIM card via SMS OTP')
    .argument('<phone>', 'Phone number to login')
    .action(async (phone) => {
      const spinner = ora('Mendeteksi ISP dan mengirim OTP...').start();
      try {
        const { provider, detectedProvider } = resolveProvider({ phone });
        spinner.text = `Menghubungkan ke ${provider.name} (${provider.brand})...`;

        const res = await provider.login(phone);
        spinner.stop();

        if (!res.success) {
          console.log(chalk.red(`Gagal login: ${res.message}`));
          return;
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

  program
    .command('quota')
    .description('Check active data quotas')
    .option('-p, --phone <phone>', 'Specific phone number to check')
    .action(async (options) => {
      const spinner = ora('Mengambil data kuota internet...').start();
      try {
        const { provider, phone } = resolveProvider({ phone: options.phone });
        const res = await provider.getQuota();
        spinner.stop();

        if (!res.success) {
          console.log(chalk.red(`Gagal: ${res.message}`));
          return;
        }

        console.log(chalk.bold.cyan(`\n--- Kuota Internet ${provider.brand} (${res.phone || phone}) ---`));
        console.log(`Ringkasan: ${chalk.bold.green(res.totalRemainingFormatted || 'Aktif')}`);

        if (res.items.length > 0) {
          const table = new Table({
            head: [chalk.cyan('Paket'), chalk.cyan('Sisa Kuota'), chalk.cyan('Masa Berlaku')],
            colWidths: [30, 20, 24]
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

  return program;
}
