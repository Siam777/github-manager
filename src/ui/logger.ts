import pc from 'picocolors';
import boxen from 'boxen';

export const logger = {
  success(message: string): void {
    console.log(`${pc.green('✔')} ${message}`);
  },

  error(message: string): void {
    console.error(`${pc.red('✖')} ${pc.red(message)}`);
  },

  warn(message: string): void {
    console.warn(`${pc.yellow('⚠')} ${message}`);
  },

  info(message: string): void {
    console.log(`${pc.cyan('ℹ')} ${message}`);
  },

  step(stepNumber: number, total: number, message: string): void {
    console.log(`${pc.magenta(`[${stepNumber}/${total}]`)} ${message}`);
  },

  dim(message: string): void {
    console.log(pc.dim(message));
  },

  highlight(label: string, value: string): void {
    console.log(`  ${pc.bold(label)}: ${pc.cyan(value)}`);
  },

  box(content: string, title?: string, borderColor: 'cyan' | 'green' | 'yellow' | 'magenta' = 'cyan'): void {
    console.log(
      boxen(content, {
        padding: 1,
        margin: { top: 0, bottom: 0 },
        borderStyle: 'round',
        borderColor,
        title: title ? pc.bold(title) : undefined,
        titleAlignment: 'left',
      })
    );
  },
};
