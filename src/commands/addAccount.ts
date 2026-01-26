/**
 * addAccount.ts - 添加账号命令
 * 通过 Firebase Auth 登录获取 Token 和 API Key
 */

import * as vscode from 'vscode';
import { AccountManager } from '../accountManager';
import { ApiHelper } from '../apiHelper';

/**
 * 注册添加账号命令
 */
export function registerAddAccountCommand(
    context: vscode.ExtensionContext,
    accountManager: AccountManager
): vscode.Disposable {

    return vscode.commands.registerCommand('windsurfSwitch.addAccount', async () => {
        try {
            // 输入邮箱
            const email = await vscode.window.showInputBox({
                title: '添加账号 - 邮箱',
                prompt: '请输入 Windsurf 账号邮箱',
                placeHolder: 'example@email.com',
                validateInput: (value) => {
                    if (!value || !value.includes('@')) {
                        return '请输入有效的邮箱地址';
                    }
                    return null;
                }
            });

            if (!email) {
                return;
            }

            // 输入密码
            const password = await vscode.window.showInputBox({
                title: '添加账号 - 密码',
                prompt: '请输入账号密码',
                password: true,
                validateInput: (value) => {
                    if (!value || value.length < 6) {
                        return '请输入有效的密码（至少6位）';
                    }
                    return null;
                }
            });

            if (!password) {
                return;
            }

            // 显示进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在登录获取 Token...',
                cancellable: false
            }, async (progress) => {

                // 创建输出通道显示日志
                const outputChannel = vscode.window.createOutputChannel('Windsurf 换号');
                outputChannel.show();

                const logCallback = (message: string) => {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
                };

                // 调用 Firebase Auth 登录
                const apiHelper = new ApiHelper(logCallback);
                const result = await apiHelper.login(email, password);

                if (result.success) {
                    progress.report({ message: '登录成功，正在保存账号...' });

                    // 保存账号
                    const account = await accountManager.addAccount({
                        email: result.email!,
                        name: result.name!,
                        apiKey: result.apiKey!,
                        apiServerUrl: result.apiServerUrl!,
                        refreshToken: result.refreshToken!,
                        planName: 'Pro'
                    });

                    outputChannel.appendLine('');
                    outputChannel.appendLine('========== 账号添加成功 ==========');
                    outputChannel.appendLine(`邮箱: ${account.email}`);
                    outputChannel.appendLine(`名称: ${account.name}`);
                    outputChannel.appendLine(`API Key: ${account.apiKey.substring(0, 20)}...`);
                    outputChannel.appendLine('');

                    vscode.window.showInformationMessage(`账号 "${account.email}" 添加成功！`);

                    // 刷新面板
                    vscode.commands.executeCommand('windsurfSwitch.refreshPanel');

                } else {
                    outputChannel.appendLine('');
                    outputChannel.appendLine('========== 登录失败 ==========');
                    outputChannel.appendLine(`错误: ${result.error}`);
                    outputChannel.appendLine('');

                    vscode.window.showErrorMessage(`登录失败: ${result.error}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`添加账号失败: ${(error as Error).message}`);
        }
    });
}
