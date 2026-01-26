/**
 * accountPanelProvider.ts - 账号管理面板 WebView 提供者
 * 提供可视化的账号管理界面
 */

import * as vscode from 'vscode';
import { AccountManager, Account } from './accountManager';
import { AccountSwitcher } from './accountSwitcher';
import { ApiHelper } from './apiHelper';

/**
 * 账号面板提供者
 */
export class AccountPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'windsurfSwitch.accountPanel';

  private _view?: vscode.WebviewView;
  private _accountManager: AccountManager;
  private _accountSwitcher: AccountSwitcher;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    accountManager: AccountManager,
    accountSwitcher: AccountSwitcher
  ) {
    this._accountManager = accountManager;
    this._accountSwitcher = accountSwitcher;
  }

  /**
   * 解析 WebView
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 处理来自 WebView 的消息
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getAccounts':
          await this._sendAccountList();
          break;

        case 'getCurrentAccount':
          await this._sendCurrentAccount();
          break;

        case 'switchAccount':
          await this._switchAccount(data.accountId);
          break;

        case 'addAccountByLogin':
          await this._addAccountByLogin(data.email, data.password);
          break;

        case 'addAccountManual':
          await this._addAccountManual(data);
          break;

        case 'deleteAccount':
          await this._deleteAccount(data.accountId);
          break;

        case 'copyApiKey':
          await this._copyApiKey(data.accountId);
          break;

        case 'deleteAccountsByType':
          await this._deleteAccountsByType(data.accountType);
          break;

        case 'confirmDelete':
          await this._confirmAndDeleteAccount(data.accountId);
          break;

        case 'confirmDeleteByType':
          await this._confirmAndDeleteByType(data.accountType);
          break;

        case 'getRefreshSetting':
          await this._sendRefreshSetting();
          break;

        case 'setRefreshSetting':
          await this._setRefreshSetting(data.value);
          break;
      }
    });

    // 初始加载数据
    this._sendAccountList();
    this._sendCurrentAccount();
  }

  /**
   * 刷新面板
   */
  public refresh() {
    if (this._view) {
      this._sendAccountList();
      this._sendCurrentAccount();
    }
  }

  /**
   * 发送账号列表到 WebView
   */
  private async _sendAccountList() {
    if (!this._view) return;

    const accounts = await this._accountManager.getAccounts();
    this._view.webview.postMessage({
      type: 'accountList',
      accounts: accounts.map(acc => ({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        planName: acc.planName,
        accountType: acc.accountType || 'OTHER'
      }))
    });
  }

  /**
   * 发送当前账号到 WebView
   */
  private async _sendCurrentAccount() {
    if (!this._view) return;

    const current = await this._accountSwitcher.getCurrentAccount();
    this._view.webview.postMessage({
      type: 'currentAccount',
      account: current ? { email: current.email, name: current.name } : null
    });
  }

  /**
   * 切换账号
   */
  private async _switchAccount(accountId: string) {
    const account = await this._accountManager.getAccount(accountId);
    if (!account) {
      this._sendMessage('error', '账号不存在');
      return;
    }

    const refreshOnSwitch = vscode.workspace.getConfiguration().get<boolean>('windsurfSwitch.refreshOnSwitch', true);
    this._sendMessage('info', '正在切换账号...');
    const result = await this._accountSwitcher.switchAccount(account, refreshOnSwitch);

    if (result.success) {
      if (refreshOnSwitch) {
        this._sendMessage('success', '切换成功，窗口即将重载...');
      } else {
        this._sendMessage('success', '切换成功（无刷新模式）');
      }
    } else {
      this._sendMessage('error', `切换失败: ${result.error}`);
    }
  }

  /**
   * 通过登录添加账号（Firebase Auth）
   */
  private async _addAccountByLogin(email: string, password: string) {
    if (!email || !password) {
      this._sendMessage('error', '请输入邮箱和密码');
      return;
    }

    this._sendMessage('info', '正在登录...');

    const apiHelper = new ApiHelper((msg) => {
      this._sendMessage('info', msg);
    });

    const result = await apiHelper.login(email, password);

    if (result.success) {
      await this._accountManager.addAccount({
        email: result.email!,
        name: result.name!,
        apiKey: result.apiKey!,
        apiServerUrl: result.apiServerUrl!,
        refreshToken: result.refreshToken!,
        planName: 'Pro'
      });

      this._sendMessage('success', `账号 ${result.email} 添加成功！`);
      await this._sendAccountList();
    } else {
      this._sendMessage('error', `登录失败: ${result.error}`);
    }
  }

  /**
   * 手动添加账号（直接输入 API Key）
   */
  private async _addAccountManual(accountData: {
    email: string;
    name: string;
    apiKey: string;
    apiServerUrl?: string;
    accountType?: string;
  }) {
    if (!accountData.email || !accountData.apiKey) {
      this._sendMessage('error', '邮箱和 API Key 为必填项');
      return;
    }

    try {
      await this._accountManager.addAccount({
        email: accountData.email,
        name: accountData.name || accountData.email.split('@')[0],
        apiKey: accountData.apiKey,
        apiServerUrl: accountData.apiServerUrl || 'https://server.self-serve.windsurf.com',
        refreshToken: '',
        planName: 'Pro',
        accountType: accountData.accountType
      });

      this._sendMessage('success', `账号 ${accountData.email} 添加成功！`);
      await this._sendAccountList();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this._sendMessage('error', `添加失败: ${errorMessage}`);
    }
  }

  /**
   * 删除账号
   */
  private async _deleteAccount(accountId: string) {
    const account = await this._accountManager.getAccount(accountId);
    if (!account) {
      this._sendMessage('error', '账号不存在');
      return;
    }

    await this._accountManager.removeAccount(accountId);
    this._sendMessage('success', `账号 ${account.email} 已删除`);
    await this._sendAccountList();
  }

  /**
   * 确认并删除单个账号
   */
  private async _confirmAndDeleteAccount(accountId: string) {
    const account = await this._accountManager.getAccount(accountId);
    if (!account) {
      this._sendMessage('error', '账号不存在');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `确定删除账号 ${account.email} 吗？`,
      { modal: true },
      '删除'
    );

    if (confirm === '删除') {
      await this._deleteAccount(accountId);
    }
  }

  /**
   * 确认并按类型批量删除账号
   */
  private async _confirmAndDeleteByType(accountType: string) {
    const accounts = await this._accountManager.getAccounts();
    const toDelete = accounts.filter(acc => (acc.accountType || 'OTHER') === accountType);

    if (toDelete.length === 0) {
      this._sendMessage('info', `没有 ${accountType} 类型的账号`);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `确定删除所有 ${accountType} 类型的账号吗？(共 ${toDelete.length} 个)`,
      { modal: true },
      '删除'
    );

    if (confirm === '删除') {
      await this._deleteAccountsByType(accountType);
    }
  }

  /**
   * 按类型批量删除账号
   */
  private async _deleteAccountsByType(accountType: string) {
    const accounts = await this._accountManager.getAccounts();
    const toDelete = accounts.filter(acc => (acc.accountType || 'OTHER') === accountType);

    if (toDelete.length === 0) {
      this._sendMessage('info', `没有 ${accountType} 类型的账号`);
      return;
    }

    for (const acc of toDelete) {
      await this._accountManager.removeAccount(acc.id);
    }

    this._sendMessage('success', `已删除 ${toDelete.length} 个 ${accountType} 类型账号`);
    await this._sendAccountList();
  }

  /**
   * 复制 API Key
   */
  private async _copyApiKey(accountId: string) {
    const account = await this._accountManager.getAccount(accountId);
    if (!account) {
      this._sendMessage('error', '账号不存在');
      return;
    }

    await vscode.env.clipboard.writeText(account.apiKey);
    this._sendMessage('success', 'API Key 已复制');
  }

  /**
   * 发送消息到 WebView
   */
  private _sendMessage(msgType: 'info' | 'success' | 'error', text: string) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'message', msgType, text });
    }
  }

  /**
   * 发送刷新设置到 WebView
   */
  private async _sendRefreshSetting() {
    if (!this._view) return;
    const refreshOnSwitch = vscode.workspace.getConfiguration().get<boolean>('windsurfSwitch.refreshOnSwitch', true);
    this._view.webview.postMessage({
      type: 'refreshSetting',
      value: refreshOnSwitch
    });
  }

  /**
   * 设置刷新选项
   */
  private async _setRefreshSetting(value: boolean) {
    await vscode.workspace.getConfiguration().update('windsurfSwitch.refreshOnSwitch', value, vscode.ConfigurationTarget.Global);
    this._sendMessage('success', value ? '已开启切换后刷新' : '已关闭切换后刷新');
  }

  /**
   * 生成 WebView HTML
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Windsurf 账号管理</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }
    
    .section {
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    .current-account {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .current-account .email {
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    
    .current-account .name {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    
    .current-account .badge {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      margin-top: 6px;
    }
    
    .no-account {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    
    .account-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .search-box {
      margin-bottom: 8px;
    }
    
    .search-input {
      width: 100%;
      padding: 8px 10px;
      padding-left: 32px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 13px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23888888'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 10px center;
      background-size: 14px;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    
    .search-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    
    .search-result-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      padding: 4px 0;
    }
    
    .account-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .account-item:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    
    .account-item.current {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }
    
    .account-item .info {
      flex: 1;
      min-width: 0;
    }
    
    .account-item .email {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .account-item .name {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .account-item .actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    
    .account-item:hover .actions {
      opacity: 1;
    }
    
    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .add-form {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .add-form.show {
      display: flex;
    }
    
    .input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 13px;
    }
    
    .input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    
    .input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    
    .form-actions {
      display: flex;
      gap: 8px;
    }
    
    .form-actions .btn {
      flex: 1;
    }
    
    .message {
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 12px;
      display: none;
    }
    
    .message.show {
      display: block;
    }
    
    .message.info {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
    }
    
    .message.success {
      background: rgba(40, 167, 69, 0.2);
      border: 1px solid rgba(40, 167, 69, 0.5);
      color: #28a745;
    }
    
    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }
    
    .empty-state {
      text-align: center;
      padding: 24px 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state .icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .toggle-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      margin-bottom: 12px;
    }
    
    .toggle-label {
      font-size: 13px;
      color: var(--vscode-foreground);
    }
    
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      background: var(--vscode-input-background);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .toggle-switch.active {
      background: var(--vscode-button-background);
    }
    
    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--vscode-button-foreground);
      border-radius: 50%;
      transition: transform 0.2s;
    }
    
    .toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    .account-group {
      margin-bottom: 16px;
    }
    
    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-radius: 4px;
      margin-bottom: 4px;
      cursor: pointer;
      user-select: none;
    }
    
    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .group-header .group-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .group-header .collapse-icon {
      transition: transform 0.2s;
    }
    
    .group-header.collapsed .collapse-icon {
      transform: rotate(-90deg);
    }
    
    .account-group-items {
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    
    .account-group-items.collapsed {
      max-height: 0 !important;
    }
    
    .group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground);
      letter-spacing: 0.5px;
    }
    
    .shortcut-container {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 10px 12px;
    }
    
    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    
    .shortcut-label {
      font-size: 12px;
      color: var(--vscode-foreground);
    }
    
    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .shortcut-key {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      white-space: nowrap;
    }
    
    .shortcut-divider {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
    
    .form-switch {
      text-align: center;
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-top: 8px;
      padding: 4px;
    }
    
    .form-switch:hover {
      text-decoration: underline;
    }
    
    .group-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      text-decoration: none;
      color: var(--vscode-foreground);
      transition: all 0.15s;
      cursor: pointer;
    }
    
    .group-link:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    
    .group-icon {
      font-size: 16px;
    }
    
    .group-text {
      flex: 1;
      font-size: 13px;
    }
    
    .group-arrow {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    
    .tip-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 6px;
      margin-bottom: 10px;
    }
    
    .tip-icon {
      font-size: 14px;
    }
    
    .tip-text {
      font-size: 11px;
      color: var(--vscode-foreground);
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div id="message" class="message"></div>
  
  <div class="section">
    <div class="section-title">当前账号</div>
    <div id="currentAccount" class="current-account">
      <div class="no-account">加载中...</div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">切换设置</div>
    <div class="toggle-container">
      <span class="toggle-label">切换后刷新窗口</span>
      <div id="refreshToggle" class="toggle-switch active" onclick="toggleRefresh()"></div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">快捷键</div>
    <div class="shortcut-container">
      <div class="shortcut-item">
        <span class="shortcut-label">切换下一个账号</span>
        <div class="shortcut-keys">
          <span class="shortcut-key" title="Mac">⌘ + ⌥ + K</span>
          <span class="shortcut-divider">|</span>
          <span class="shortcut-key" title="Windows">Ctrl + Alt + K</span>
        </div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">添加账号</div>
    <div class="tip-box">
      <span class="tip-icon">🪄</span>
      <span class="tip-text">需开启魔法才能连接 Google Firebase 获取 API Key</span>
    </div>
    
    <!-- 登录模式表单 -->
    <div id="loginForm" class="add-form">
      <input type="email" id="loginEmailInput" class="input" placeholder="邮箱地址">
      <input type="password" id="loginPasswordInput" class="input" placeholder="密码">
      <div class="form-actions">
        <button class="btn btn-primary" onclick="submitLogin()">登录添加</button>
        <button class="btn btn-secondary" onclick="cancelAdd()">取消</button>
      </div>
      <div class="form-switch" onclick="switchToManual()">手动输入 API Key →</div>
    </div>
    
    <!-- 手动模式表单 -->
    <div id="manualForm" class="add-form">
      <input type="email" id="manualEmailInput" class="input" placeholder="邮箱地址 *">
      <input type="text" id="manualNameInput" class="input" placeholder="名称 (可选)">
      <input type="text" id="manualApiKeyInput" class="input" placeholder="API Key *">
      <input type="text" id="manualApiServerUrlInput" class="input" placeholder="API Server URL (可选)">
      <select id="manualAccountTypeInput" class="input">
        <option value="">选择账号类型 (可选)</option>
        <option value="enterprise">ENTERPRISE</option>
        <option value="pro">PRO</option>
        <option value="trial">TRIAL</option>
        <option value="free">FREE</option>
      </select>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="submitManual()">添加</button>
        <button class="btn btn-secondary" onclick="cancelAdd()">取消</button>
      </div>
      <div class="form-switch" onclick="switchToLogin()">← 使用邮箱密码登录</div>
    </div>
    
    <button id="addBtn" class="btn btn-primary" onclick="showLoginForm()">
      <span>+</span> 添加账号
    </button>
  </div>
  
  <div class="section">
    <div class="section-title">账号列表</div>
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="搜索账号 (邮箱/名称)" oninput="handleSearch()">
    </div>
    <div id="searchResultInfo" class="search-result-info" style="display: none;"></div>
    <div id="accountList" class="account-list">
      <div class="empty-state">
        <div class="icon">📭</div>
        <div>暂无账号</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">交流群</div>
    <a href="https://qm.qq.com/q/UsRJVIm10" class="group-link" title="点击加入群聊">
      <span class="group-icon">💬</span>
      <span class="group-text">Code 开源技术交流群</span>
      <span class="group-arrow">→</span>
    </a>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    let accounts = [];
    let currentEmail = null;
    let searchKeyword = '';
    let collapsedGroups = {}; // 记录分组折叠状态
    
    // 请求数据
    vscode.postMessage({ type: 'getAccounts' });
    vscode.postMessage({ type: 'getCurrentAccount' });
    vscode.postMessage({ type: 'getRefreshSetting' });
    
    // 搜索处理函数
    function handleSearch() {
      searchKeyword = document.getElementById('searchInput').value.trim().toLowerCase();
      renderAccountList();
    }
    
    // 切换分组折叠
    function toggleGroup(groupType) {
      collapsedGroups[groupType] = !collapsedGroups[groupType];
      renderAccountList();
    }
    
    // 接收消息
    window.addEventListener('message', event => {
      const data = event.data;
      
      switch (data.type) {
        case 'accountList':
          accounts = data.accounts;
          renderAccountList();
          break;
          
        case 'currentAccount':
          currentEmail = data.account?.email;
          renderCurrentAccount(data.account);
          renderAccountList();
          break;
          
        case 'message':
          showMessage(data.msgType, data.text);
          break;
          
        case 'refreshSetting':
          updateRefreshToggle(data.value);
          break;
      }
    });
    
    function renderCurrentAccount(account) {
      const el = document.getElementById('currentAccount');
      if (account) {
        el.innerHTML = \`
          <div class="email">\${account.email}</div>
          <div class="name">\${account.name}</div>
          <div class="badge">当前使用</div>
        \`;
      } else {
        el.innerHTML = '<div class="no-account">未登录</div>';
      }
    }
    
    function renderAccountList() {
      const el = document.getElementById('accountList');
      const resultInfoEl = document.getElementById('searchResultInfo');
      
      // 根据搜索关键词过滤账号
      let filteredAccounts = accounts;
      if (searchKeyword) {
        filteredAccounts = accounts.filter(acc => 
          acc.email.toLowerCase().includes(searchKeyword) ||
          (acc.name && acc.name.toLowerCase().includes(searchKeyword))
        );
        
        // 显示搜索结果信息
        resultInfoEl.style.display = 'block';
        resultInfoEl.textContent = '找到 ' + filteredAccounts.length + ' 个匹配账号';
      } else {
        resultInfoEl.style.display = 'none';
      }
      
      if (filteredAccounts.length === 0) {
        if (searchKeyword) {
          el.innerHTML = \`
            <div class="empty-state">
              <div class="icon">🔍</div>
              <div>未找到匹配 "\${searchKeyword}" 的账号</div>
            </div>
          \`;
        } else {
          el.innerHTML = \`
            <div class="empty-state">
              <div class="icon">📭</div>
              <div>暂无账号，点击上方添加</div>
            </div>
          \`;
        }
        return;
      }
      
      // 按 accountType 分组
      const groups = {};
      filteredAccounts.forEach(acc => {
        const type = acc.accountType || 'OTHER';
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(acc);
      });
      
      // 按照固定顺序排列组
      const typeOrder = ['enterprise', 'pro', 'trial', 'free', 'OTHER'];
      let html = '';
      
      typeOrder.forEach(type => {
        if (groups[type] && groups[type].length > 0) {
          const isCollapsed = collapsedGroups[type];
          html += \`
            <div class="account-group">
              <div class="group-header \${isCollapsed ? 'collapsed' : ''}" onclick="toggleGroup('\${type}')">
                <div class="group-left">
                  <span class="collapse-icon">\${isCollapsed ? '▶' : '▼'}</span>
                  <span class="group-title">\${type} (\${groups[type].length})</span>
                </div>
                <button class="icon-btn" onclick="event.stopPropagation(); deleteAccountsByType('\${type}')" title="删除该类型所有账号">🗑️</button>
              </div>
              <div class="account-group-items \${isCollapsed ? 'collapsed' : ''}" style="max-height: \${groups[type].length * 60}px;">
                \${groups[type].map(acc => \`
                  <div class="account-item \${acc.email === currentEmail ? 'current' : ''}" 
                       onclick="switchAccount('\${acc.id}')">
                    <div class="info">
                      <div class="email">\${acc.email}</div>
                      <div class="name">\${acc.name} · \${acc.planName}</div>
                    </div>
                    <div class="actions">
                      <button class="icon-btn" onclick="event.stopPropagation(); copyApiKey('\${acc.id}')" title="复制 API Key">📋</button>
                      <button class="icon-btn" onclick="event.stopPropagation(); deleteAccount('\${acc.id}')" title="删除">🗑️</button>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>
          \`;
        }
      });
      
      el.innerHTML = html;
    }
    
    function deleteAccountsByType(accountType) {
      vscode.postMessage({ type: 'confirmDeleteByType', accountType });
    }
    
    function showLoginForm() {
      document.getElementById('loginForm').classList.add('show');
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('addBtn').style.display = 'none';
      document.getElementById('loginEmailInput').focus();
    }
    
    function showManualForm() {
      document.getElementById('manualForm').classList.add('show');
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('addBtn').style.display = 'none';
      document.getElementById('manualEmailInput').focus();
    }
    
    function switchToManual() {
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('manualForm').classList.add('show');
      document.getElementById('manualEmailInput').focus();
    }
    
    function switchToLogin() {
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('loginForm').classList.add('show');
      document.getElementById('loginEmailInput').focus();
    }
    
    function cancelAdd() {
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('addBtn').style.display = 'flex';
      // 清空登录表单
      document.getElementById('loginEmailInput').value = '';
      document.getElementById('loginPasswordInput').value = '';
      // 清空手动表单
      document.getElementById('manualEmailInput').value = '';
      document.getElementById('manualNameInput').value = '';
      document.getElementById('manualApiKeyInput').value = '';
      document.getElementById('manualApiServerUrlInput').value = '';
      document.getElementById('manualAccountTypeInput').value = '';
    }
    
    function submitLogin() {
      const email = document.getElementById('loginEmailInput').value.trim();
      const password = document.getElementById('loginPasswordInput').value;
      
      if (!email || !password) {
        showMessage('error', '请输入邮箱和密码');
        return;
      }
      
      vscode.postMessage({ type: 'addAccountByLogin', email, password });
      cancelAdd();
    }
    
    function submitManual() {
      const email = document.getElementById('manualEmailInput').value.trim();
      const name = document.getElementById('manualNameInput').value.trim();
      const apiKey = document.getElementById('manualApiKeyInput').value.trim();
      const apiServerUrl = document.getElementById('manualApiServerUrlInput').value.trim();
      const accountType = document.getElementById('manualAccountTypeInput').value;
      
      if (!email || !apiKey) {
        showMessage('error', '请输入邮箱和 API Key');
        return;
      }
      
      vscode.postMessage({ 
        type: 'addAccountManual', 
        email, 
        name, 
        apiKey, 
        apiServerUrl,
        accountType
      });
      cancelAdd();
    }
    
    function switchAccount(accountId) {
      const acc = accounts.find(a => a.id === accountId);
      if (acc && acc.email === currentEmail) {
        showMessage('info', '已经是当前账号');
        return;
      }
      vscode.postMessage({ type: 'switchAccount', accountId });
    }
    
    function copyApiKey(accountId) {
      vscode.postMessage({ type: 'copyApiKey', accountId });
    }
    
    function deleteAccount(accountId) {
      vscode.postMessage({ type: 'confirmDelete', accountId });
    }
    
    function showMessage(type, text) {
      const el = document.getElementById('message');
      el.className = 'message show ' + type;
      el.textContent = text;
      
      if (type !== 'info') {
        setTimeout(() => {
          el.classList.remove('show');
        }, 3000);
      }
    }
    
    let refreshOnSwitch = true;
    
    function updateRefreshToggle(value) {
      refreshOnSwitch = value;
      const toggle = document.getElementById('refreshToggle');
      if (value) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    }
    
    function toggleRefresh() {
      refreshOnSwitch = !refreshOnSwitch;
      updateRefreshToggle(refreshOnSwitch);
      vscode.postMessage({ type: 'setRefreshSetting', value: refreshOnSwitch });
    }
    
    // 回车提交 - 登录模式
    document.getElementById('loginPasswordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitLogin();
    });
    
    // 回车提交 - 手动模式
    document.getElementById('manualApiKeyInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitManual();
    });
  </script>
</body>
</html>`;
  }
}
