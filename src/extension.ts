/**
 * extension.ts - Windsurf 无感换号插件入口
 * 
 * 功能：
 * - 管理 Windsurf 账号列表
 * - 一键切换账号（自动重载窗口）
 * - 状态栏显示当前账号
 * - 侧边栏可视化操作面板
 */

import * as vscode from 'vscode';
import { AccountManager } from './accountManager';
import { AccountSwitcher } from './accountSwitcher';
import { AccountPanelProvider } from './accountPanelProvider';
import { registerSwitchAccountCommand } from './commands/switchAccount';
import { registerAddAccountCommand } from './commands/addAccount';
import { registerSwitchNextAccountCommand } from './commands/switchNextAccount';
import {
    registerListAccountsCommand,
    registerRemoveAccountCommand,
    registerShowCurrentAccountCommand
} from './commands/listAccounts';


// 面板提供者
let panelProvider: AccountPanelProvider;

/**
 * 插件激活
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('[WindsurfSwitch] 插件已激活');

    // 初始化管理器
    const accountManager = new AccountManager(context);
    const accountSwitcher = new AccountSwitcher();

    // 创建并注册侧边栏面板
    panelProvider = new AccountPanelProvider(
        context.extensionUri,
        accountManager,
        accountSwitcher
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            AccountPanelProvider.viewType,
            panelProvider
        )
    );

    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand('windsurfSwitch.refreshPanel', () => {
            panelProvider.refresh();
        })
    );

    // 注册其他命令
    context.subscriptions.push(
        registerSwitchAccountCommand(context, accountManager, accountSwitcher),
        registerAddAccountCommand(context, accountManager),
        registerSwitchNextAccountCommand(context, accountManager, accountSwitcher),
        registerListAccountsCommand(context, accountManager, accountSwitcher),
        registerRemoveAccountCommand(context, accountManager),
        registerShowCurrentAccountCommand(context, accountSwitcher)
    );

    console.log('[WindsurfSwitch] 初始化完成');
}

/**
 * 插件停用
 */
export function deactivate() {
    console.log('[WindsurfSwitch] 插件已停用');
}

