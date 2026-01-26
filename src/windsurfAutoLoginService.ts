import * as vscode from 'vscode';
import { WindsurfPatchService, PatchCheckResult } from './windsurfPatchService';

export interface AutoLoginResult {
    success: boolean;
    error?: string;
    needsRestart?: boolean;
}

export class WindsurfAutoLoginService {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * 注入 Windsurf 会话，实现自动登录
     * @param apiKey API 密钥
     * @param mail 邮箱地址 (用作用户名)
     * @param apiServerUrl API 服务器地址
     * @returns 登录结果
     */
    async injectSession(apiKey: string, mail: string, apiServerUrl: string): Promise<AutoLoginResult> {
        try {
            // 验证必需参数
            if (!apiKey || !mail || !apiServerUrl) {
                return {
                    success: false,
                    error: "缺少必要的凭据 (apiKey, mail, 或 apiServerUrl)"
                };
            }

            // 1. 检查并应用补丁（如果需要）
            console.log('🌊 [WindsurfAutoLoginService] 开始检查 Windsurf 补丁...');
            const patchResult = await WindsurfPatchService.checkAndApplyPatch();
            
            if (patchResult.needsRestart) {
                // 需要重启 Windsurf
                console.log('🔄 [WindsurfAutoLoginService] 补丁已应用，准备重启 Windsurf...');
                vscode.window.showInformationMessage("补丁已应用，Windsurf 正在重启。重启完成后请再次点击【刷新】按钮。");
                
                // 延迟1秒后重启窗口
                setTimeout(() => {
                    console.log('🔄 [WindsurfAutoLoginService] 执行窗口重启命令...');
                    vscode.commands.executeCommand("workbench.action.reloadWindow");
                }, 1000);
                
                return {
                    success: false,
                    needsRestart: true,
                    error: "补丁已应用，Windsurf 正在重启"
                };
            }
            
            if (patchResult.error) {
                console.error('❌ [WindsurfAutoLoginService] 补丁检查/应用失败:', patchResult.error);
                return {
                    success: false,
                    error: patchResult.error
                };
            }

            console.log('✅ [WindsurfAutoLoginService] 补丁检查完成，开始执行登录流程...');

            try {
                // 2. 先尝试登出（清理现有会话）
                console.log('🚪 [WindsurfAutoLoginService] 尝试登出现有会话...');
                try {
                    await vscode.commands.executeCommand("windsurf.logout");
                    console.log('✅ [WindsurfAutoLoginService] 登出成功');
                } catch (logoutError) {
                    // 登出失败不影响后续流程，可能用户本来就没登录
                    console.warn('⚠️ [WindsurfAutoLoginService] 登出失败 (用户可能本来就没登录):', logoutError);
                }

                // 3. 执行自动登录命令
                console.log('🔐 [WindsurfAutoLoginService] 执行自动登录命令...');
                console.log(`📧 [WindsurfAutoLoginService] 用户邮箱: ${mail}`);
                console.log(`🔗 [WindsurfAutoLoginService] API 服务器: ${apiServerUrl}`);
                console.log(`🔑 [WindsurfAutoLoginService] API 密钥: ${apiKey.substring(0, 20)}...`);
                
                await vscode.commands.executeCommand("windsurf.provideAuthTokenToAuthProviderWithShit", {
                    apiKey: apiKey,
                    name: mail, // 使用邮箱作为用户名
                    apiServerUrl: apiServerUrl
                });

                console.log('🎉 [WindsurfAutoLoginService] 自动登录成功！');
                return {
                    success: true
                };

            } catch (authError) {
                console.error('❌ [WindsurfAutoLoginService] 自动登录失败:', authError);
                return {
                    success: false,
                    error: `认证命令失败: ${authError instanceof Error ? authError.message : "执行认证命令时发生未知错误"}`
                };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            console.error('WindsurfAutoLoginService error:', error);
            
            return {
                success: false,
                error: `会话注入失败: ${error instanceof Error ? error.message : "会话注入过程中发生未知错误"}`
            };
        }
    }

    /**
     * 检查是否支持自动登录功能
     * @returns 是否支持自动登录
     */
    async isAutoLoginSupported(): Promise<boolean> {
        try {
            // 检查 Windsurf 命令是否可用
            const commands = await vscode.commands.getCommands();
            return commands.includes("windsurf.provideAuthTokenToAuthProviderWithShit");
        } catch (error) {
            console.warn('检查自动登录支持失败:', error);
            return false;
        }
    }

    /**
     * 获取当前 Windsurf 登录状态
     * @returns 登录状态信息
     */
    async getLoginStatus(): Promise<{ isLoggedIn: boolean; userInfo?: any }> {
        try {
            // 尝试获取当前用户信息（如果有相关命令的话）
            // 这里可能需要根据实际的 Windsurf API 调整
            return { isLoggedIn: false }; // 暂时返回默认值
        } catch (error) {
            console.warn('获取登录状态失败:', error);
            return { isLoggedIn: false };
        }
    }
}
