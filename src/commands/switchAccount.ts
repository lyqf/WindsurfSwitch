/**
 * switchAccount.ts - 切换账号命令
 */

import * as vscode from 'vscode';
import { AccountManager, Account } from '../accountManager';
import { AccountSwitcher } from '../accountSwitcher';

/**
 * 注册切换账号命令
 */
export function registerSwitchAccountCommand(
    context: vscode.ExtensionContext,
    accountManager: AccountManager,
    accountSwitcher: AccountSwitcher
): vscode.Disposable {

    return vscode.commands.registerCommand('windsurfSwitch.switchAccount', async () => {
        try {
            // 获取账号列表
            const accounts = await accountManager.getAccounts();

            if (accounts.length === 0) {
                const action = await vscode.window.showWarningMessage(
                    '没有保存的账号，是否现在添加？',
                    '添加账号',
                    '取消'
                );

                if (action === '添加账号') {
                    await vscode.commands.executeCommand('windsurfSwitch.addAccount');
                }
                return;
            }

            // 获取当前账号
            const currentAccount = await accountSwitcher.getCurrentAccount();

            // 构建选择列表
            const items: vscode.QuickPickItem[] = accounts.map(acc => ({
                label: acc.email,
                description: acc.name,
                detail: currentAccount?.email === acc.email ? '(当前账号)' : acc.planName,
                picked: currentAccount?.email === acc.email
            }));

            // 显示选择菜单
            const selected = await vscode.window.showQuickPick(items, {
                title: 'Windsurf 切换账号',
                placeHolder: '选择要切换的账号',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected) {
                return;
            }

            // 查找选中的账号
            const targetAccount = accounts.find(acc => acc.email === selected.label);

            if (!targetAccount) {
                vscode.window.showErrorMessage('账号不存在');
                return;
            }

            // 检查是否是当前账号
            if (currentAccount?.email === targetAccount.email) {
                vscode.window.showInformationMessage('已经是当前账号');
                return;
            }

            // 确认切换
            const confirm = await vscode.window.showWarningMessage(
                `确定要切换到账号 "${targetAccount.email}" 吗？\n窗口将会重载以应用更改。`,
                { modal: true },
                '确定切换'
            );

            if (confirm !== '确定切换') {
                return;
            }

            // 执行切换
            const refreshOnSwitch = vscode.workspace.getConfiguration().get<boolean>('windsurfSwitch.refreshOnSwitch', true);
            const result = await accountSwitcher.switchAccount(targetAccount, refreshOnSwitch);

            if (!result.success) {
                vscode.window.showErrorMessage(`切换失败: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`切换账号时发生错误: ${(error as Error).message}`);
        }
    });
}
