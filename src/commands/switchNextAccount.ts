/**
 * switchNextAccount.ts - 快捷键切换下一个账号命令
 */

import * as vscode from 'vscode';
import { AccountManager } from '../accountManager';
import { AccountSwitcher } from '../accountSwitcher';

/**
 * 注册切换下一个账号命令
 */
export function registerSwitchNextAccountCommand(
    context: vscode.ExtensionContext,
    accountManager: AccountManager,
    accountSwitcher: AccountSwitcher
): vscode.Disposable {
    return vscode.commands.registerCommand('windsurfSwitch.switchNextAccount', async () => {
        try {
            // 获取账号列表
            const accounts = await accountManager.getAccounts();

            if (accounts.length === 0) {
                vscode.window.showWarningMessage('没有可切换的账号，请先添加账号');
                return;
            }

            if (accounts.length === 1) {
                vscode.window.showInformationMessage('只有一个账号，无需切换');
                return;
            }

            // 获取下一个账号
            const { account, index } = await accountManager.getNextAccount();

            if (!account) {
                vscode.window.showErrorMessage('获取下一个账号失败');
                return;
            }

            // 显示切换提示
            vscode.window.showInformationMessage(`正在切换到: ${account.email} (${index + 1}/${accounts.length})`);

            // 执行切换
            const refreshOnSwitch = vscode.workspace.getConfiguration().get<boolean>('windsurfSwitch.refreshOnSwitch', true);
            const result = await accountSwitcher.switchAccount(account, refreshOnSwitch);

            if (result.success) {
                // 更新当前索引
                await accountManager.setCurrentAccountIndex(index);
                vscode.window.showInformationMessage(`已切换到: ${account.email}`);
            } else if (result.needsRestart) {
                // 需要重启，索引会在重启后保持
                await accountManager.setCurrentAccountIndex(index);
            } else {
                vscode.window.showErrorMessage(`切换失败: ${result.error}`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`切换账号失败: ${errorMessage}`);
        }
    });
}
