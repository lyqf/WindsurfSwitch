import * as fs from 'fs';
import { WindsurfPathService } from './windsurfPathService';

export interface PatchResult {
    success: boolean;
    error?: string;
}

export interface PatchCheckResult {
    needsRestart: boolean;
    error?: string;
}

export interface PermissionCheckResult {
    hasPermission: boolean;
    error?: string;
}

interface HandleAuthTokenMatch {
    fullMatch: string;
    index: number;
    nameVar: string;      // 变量名 (g 或 i)
    apiServerUrlVar: string;  // 变量名 (i 或 g)
}

interface CommandRegistrationMatch {
    fullMatch: string;
    index: number;
    authProviderVar: string;  // e 变量
}

export class WindsurfPatchService {
    // 检测关键字 - 用于验证补丁是否已应用
    private static readonly PATCH_KEYWORD_1 = "windsurf.provideAuthTokenToAuthProviderWithShit";
    private static readonly PATCH_KEYWORD_2 = "handleAuthTokenWithShit";

    // 使用正则表达式匹配 handleAuthToken 函数 - 适应变量名变化
    // 匹配模式：async handleAuthToken(A){...registerUser...apiKey:t,name:X...getApiServerUrl...}
    private static readonly HANDLE_AUTH_TOKEN_REGEX = /async handleAuthToken\(A\)\{const e=await\(0,E\.registerUser\)\(A\),\{apiKey:t,name:([a-zA-Z])\}=e,([a-zA-Z])=\(0,B\.getApiServerUrl\)\(e\.apiServerUrl\);if\(!t\)throw new s\.AuthMalformedLanguageServerResponseError\("Auth login failure: empty api_key"\);if\(!\1\)throw new s\.AuthMalformedLanguageServerResponseError\("Auth login failure: empty name"\);const I=\{id:\(0,n\.v4\)\(\),accessToken:t,account:\{label:\1,id:\1\},scopes:\[\]\};return await this\.context\.secrets\.store\(u\.sessionsSecretKey,JSON\.stringify\(\[I\]\)\),await this\.context\.globalState\.update\("apiServerUrl",\2\),\(0,o\.isString\)\(\2\)&&!\(0,o\.isEmpty\)\(\2\)&&\2!==r\.LanguageServerClient\.getInstance\(\)\.apiServerUrl&&await r\.LanguageServerClient\.getInstance\(\)\.restart\(\2\),this\._sessionChangeEmitter\.fire\(\{added:\[I\],removed:\[\],changed:\[\]\}\),I\}/;

    // 命令注册的正则表达式
    private static readonly COMMAND_REGISTRATION_REGEX = /s\.commands\.registerCommand\(t\.PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER,async A=>\{try\{return\{session:await ([a-zA-Z])\.handleAuthToken\(A\),error:void 0\}\}catch\(A\)\{return A instanceof a\.WindsurfError\?\{error:A\.errorMetadata\}:\{error:C\.WindsurfExtensionMetadata\.getInstance\(\)\.errorCodes\.GENERIC_ERROR\}\}\}\)/;

    /**
     * 查找 handleAuthToken 函数
     */
    private static findHandleAuthToken(content: string): HandleAuthTokenMatch | null {
        const match = content.match(this.HANDLE_AUTH_TOKEN_REGEX);
        if (!match) {
            return null;
        }
        return {
            fullMatch: match[0],
            index: match.index!,
            nameVar: match[1],           // 捕获组1: name变量 (g或i)
            apiServerUrlVar: match[2]    // 捕获组2: apiServerUrl变量 (i或g)
        };
    }

    /**
     * 查找命令注册
     */
    private static findCommandRegistration(content: string): CommandRegistrationMatch | null {
        const match = content.match(this.COMMAND_REGISTRATION_REGEX);
        if (!match) {
            return null;
        }
        return {
            fullMatch: match[0],
            index: match.index!,
            authProviderVar: match[1]    // 捕获组1: authProvider变量 (通常是e)
        };
    }

    /**
     * 根据匹配结果动态生成新的 handleAuthTokenWithShit 函数
     */
    private static generateNewHandleAuthTokenWithShit(nameVar: string, apiServerUrlVar: string): string {
        return `async handleAuthTokenWithShit(A){const{apiKey:t,name:${nameVar}}=A,${apiServerUrlVar}=(0,B.getApiServerUrl)(A.apiServerUrl);if(!t)throw new s.AuthMalformedLanguageServerResponseError("Auth login failure: empty api_key");if(!${nameVar})throw new s.AuthMalformedLanguageServerResponseError("Auth login failure: empty name");const I={id:(0,n.v4)(),accessToken:t,account:{label:${nameVar},id:${nameVar}},scopes:[]};return await this.context.secrets.store(u.sessionsSecretKey,JSON.stringify([I])),await this.context.globalState.update("apiServerUrl",${apiServerUrlVar}),(0,o.isString)(${apiServerUrlVar})&&!(0,o.isEmpty)(${apiServerUrlVar})&&${apiServerUrlVar}!==r.LanguageServerClient.getInstance().apiServerUrl&&await r.LanguageServerClient.getInstance().restart(${apiServerUrlVar}),this._sessionChangeEmitter.fire({added:[I],removed:[],changed:[]}),I}`;
    }

    /**
     * 根据匹配结果动态生成新的命令注册
     */
    private static generateNewCommandRegistration(authProviderVar: string): string {
        return `,s.commands.registerCommand("windsurf.provideAuthTokenToAuthProviderWithShit",async A=>{try{return{session:await ${authProviderVar}.handleAuthTokenWithShit(A),error:void 0}}catch(A){return A instanceof a.WindsurfError?{error:A.errorMetadata}:{error:C.WindsurfExtensionMetadata.getInstance().errorCodes.GENERIC_ERROR}}})`;
    }

    /**
     * 检查补丁是否已应用
     * @returns 是否已应用补丁
     */
    static async isPatchApplied(): Promise<boolean> {
        console.log('🔍 [WindsurfPatchService] 开始检查补丁是否已应用...');

        try {
            const extensionPath = WindsurfPathService.getExtensionPath();
            if (!extensionPath) {
                console.warn('⚠️ [WindsurfPatchService] 无法获取 Windsurf 扩展路径，补丁检查失败');
                return false;
            }

            console.log('📖 [WindsurfPatchService] 读取扩展文件内容...');
            const fileContent = fs.readFileSync(extensionPath, 'utf-8');
            console.log(`📊 [WindsurfPatchService] 文件内容长度: ${fileContent.length} 字符`);

            console.log(`🔍 [WindsurfPatchService] 检查关键字1: "${this.PATCH_KEYWORD_1}"`);
            const hasKeyword1 = fileContent.includes(this.PATCH_KEYWORD_1);
            console.log(`${hasKeyword1 ? '✅' : '❌'} [WindsurfPatchService] 关键字1 ${hasKeyword1 ? '已找到' : '未找到'}`);

            console.log(`🔍 [WindsurfPatchService] 检查关键字2: "${this.PATCH_KEYWORD_2}"`);
            const hasKeyword2 = fileContent.includes(this.PATCH_KEYWORD_2);
            console.log(`${hasKeyword2 ? '✅' : '❌'} [WindsurfPatchService] 关键字2 ${hasKeyword2 ? '已找到' : '未找到'}`);

            const isApplied = hasKeyword1 && hasKeyword2;
            console.log(`${isApplied ? '✅' : '❌'} [WindsurfPatchService] 补丁${isApplied ? '已应用' : '未应用'}`);

            return isApplied;
        } catch (error) {
            console.error('❌ [WindsurfPatchService] 检查补丁状态失败:', error);
            return false;
        }
    }

    /**
     * 检查写入权限
     * @returns 权限检查结果
     */
    static checkWritePermission(): PermissionCheckResult {
        console.log('🔍 [WindsurfPatchService] 开始检查写入权限...');

        try {
            const extensionPath = WindsurfPathService.getExtensionPath();

            if (!extensionPath) {
                console.error('❌ [WindsurfPatchService] Windsurf 安装未找到');
                return {
                    hasPermission: false,
                    error: "Windsurf installation not found. Please ensure Windsurf is installed."
                };
            }

            console.log('🔍 [WindsurfPatchService] 检查文件读取权限...');
            if (!WindsurfPathService.isFileAccessible(extensionPath)) {
                console.error('❌ [WindsurfPatchService] 文件不可读');
                return {
                    hasPermission: false,
                    error: `Cannot read Windsurf extension file at: ${extensionPath}`
                };
            }

            console.log('🔍 [WindsurfPatchService] 检查文件写入权限...');
            if (!WindsurfPathService.isFileWritable(extensionPath)) {
                console.error('❌ [WindsurfPatchService] 文件不可写');
                const suggestion = WindsurfPathService.getPermissionFixSuggestion(extensionPath);
                return {
                    hasPermission: false,
                    error: `Insufficient permissions to modify Windsurf extension at: ${extensionPath}\n\n${suggestion}`
                };
            }

            console.log('✅ [WindsurfPatchService] 权限检查通过');
            return {
                hasPermission: true
            };
        } catch (error) {
            console.error('❌ [WindsurfPatchService] 权限检查失败:', error);
            return {
                hasPermission: false,
                error: `权限检查失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 应用补丁
     * @returns 补丁应用结果
     */
    static async applyPatch(): Promise<PatchResult> {
        console.log('🔧 [WindsurfPatchService] 开始应用补丁...');

        try {
            const extensionPath = WindsurfPathService.getExtensionPath();
            if (!extensionPath) {
                console.error('❌ [WindsurfPatchService] Windsurf 安装未找到');
                return {
                    success: false,
                    error: "Windsurf installation not found"
                };
            }

            // 检查权限
            console.log('🔍 [WindsurfPatchService] 检查权限...');
            const permissionCheck = this.checkWritePermission();
            if (!permissionCheck.hasPermission) {
                console.error('❌ [WindsurfPatchService] 权限不足');
                return {
                    success: false,
                    error: permissionCheck.error
                };
            }

            // 读取原始文件
            console.log('📖 [WindsurfPatchService] 读取原始文件...');
            console.log(`📂 [WindsurfPatchService] 文件路径: ${extensionPath}`);
            let fileContent = fs.readFileSync(extensionPath, 'utf-8');
            console.log(`📊 [WindsurfPatchService] 原始文件大小: ${fileContent.length} 字符`);

            // 1. 使用正则表达式查找 handleAuthToken 函数
            console.log('🔍 [WindsurfPatchService] 使用正则表达式查找 handleAuthToken 函数...');
            const handleAuthTokenMatch = this.findHandleAuthToken(fileContent);
            
            if (!handleAuthTokenMatch) {
                console.error('❌ [WindsurfPatchService] 未找到 handleAuthToken 函数');
                // 尝试显示文件中的相关内容帮助调试
                const partialMatch = fileContent.indexOf('async handleAuthToken(A)');
                if (partialMatch !== -1) {
                    const snippet = fileContent.substring(partialMatch, partialMatch + 300);
                    console.log(`🔍 [WindsurfPatchService] 找到部分匹配: ${snippet.substring(0, 150)}...`);
                }
                return {
                    success: false,
                    error: "Could not find handleAuthToken function. Windsurf version may be incompatible.\n\nThe expected function signature was not found in extension.js.\n\nPath: " + extensionPath
                };
            }

            console.log(`✅ [WindsurfPatchService] 找到 handleAuthToken 函数，位置: ${handleAuthTokenMatch.index}`);
            console.log(`📊 [WindsurfPatchService] 检测到变量: name=${handleAuthTokenMatch.nameVar}, apiServerUrl=${handleAuthTokenMatch.apiServerUrlVar}`);

            const insertPosition1 = handleAuthTokenMatch.index + handleAuthTokenMatch.fullMatch.length;
            const newHandleAuthTokenWithShit = this.generateNewHandleAuthTokenWithShit(
                handleAuthTokenMatch.nameVar,
                handleAuthTokenMatch.apiServerUrlVar
            );
            console.log('🔧 [WindsurfPatchService] 插入新的 handleAuthTokenWithShit 函数...');
            fileContent = fileContent.substring(0, insertPosition1) +
                newHandleAuthTokenWithShit +
                fileContent.substring(insertPosition1);
            console.log(`📊 [WindsurfPatchService] 插入函数后文件大小: ${fileContent.length} 字符`);

            // 2. 使用正则表达式查找命令注册
            console.log('🔍 [WindsurfPatchService] 使用正则表达式查找命令注册...');
            const commandMatch = this.findCommandRegistration(fileContent);
            
            if (!commandMatch) {
                console.error('❌ [WindsurfPatchService] 未找到命令注册');
                // 尝试显示文件中的相关内容帮助调试
                const partialMatch = fileContent.indexOf('PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER');
                if (partialMatch !== -1) {
                    const start = Math.max(0, partialMatch - 50);
                    const snippet = fileContent.substring(start, partialMatch + 200);
                    console.log(`🔍 [WindsurfPatchService] 找到部分匹配: ...${snippet.substring(0, 200)}...`);
                }
                return {
                    success: false,
                    error: "Could not find PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER command registration. Windsurf version may be incompatible.\n\nThe expected command registration was not found in extension.js.\n\nPath: " + extensionPath
                };
            }

            console.log(`✅ [WindsurfPatchService] 找到命令注册，位置: ${commandMatch.index}`);
            console.log(`📊 [WindsurfPatchService] 检测到 authProvider 变量: ${commandMatch.authProviderVar}`);

            const insertPosition2 = commandMatch.index + commandMatch.fullMatch.length;
            const newCommandRegistration = this.generateNewCommandRegistration(commandMatch.authProviderVar);
            console.log('🔧 [WindsurfPatchService] 插入新的命令注册...');
            fileContent = fileContent.substring(0, insertPosition2) +
                newCommandRegistration +
                fileContent.substring(insertPosition2);
            console.log(`📊 [WindsurfPatchService] 插入命令后文件大小: ${fileContent.length} 字符`);

            // 写入修改后的文件
            console.log('💾 [WindsurfPatchService] 写入修改后的文件...');
            fs.writeFileSync(extensionPath, fileContent, 'utf-8');
            console.log('✅ [WindsurfPatchService] 文件写入完成');

            // 验证补丁是否成功应用
            console.log('🔍 [WindsurfPatchService] 验证补丁是否成功应用...');
            const verificationContent = fs.readFileSync(extensionPath, 'utf-8');
            const hasKeyword1 = verificationContent.includes(this.PATCH_KEYWORD_1);
            const hasKeyword2 = verificationContent.includes(this.PATCH_KEYWORD_2);

            console.log(`${hasKeyword1 ? '✅' : '❌'} [WindsurfPatchService] 验证关键字1: ${hasKeyword1 ? '存在' : '不存在'}`);
            console.log(`${hasKeyword2 ? '✅' : '❌'} [WindsurfPatchService] 验证关键字2: ${hasKeyword2 ? '存在' : '不存在'}`);

            if (hasKeyword1 && hasKeyword2) {
                console.log('🎉 [WindsurfPatchService] 补丁应用成功！');
                return {
                    success: true
                };
            } else {
                console.error('❌ [WindsurfPatchService] 补丁验证失败');
                return {
                    success: false,
                    error: "补丁验证失败。补丁应用后未找到关键字。"
                };
            }

        } catch (error) {
            console.error('❌ [WindsurfPatchService] 补丁应用失败:', error);
            return {
                success: false,
                error: `补丁失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 检查并应用补丁（如果需要）
     * @returns 检查结果
     */
    static async checkAndApplyPatch(): Promise<PatchCheckResult> {
        console.log('🚀 [WindsurfPatchService] 开始检查并应用补丁流程...');

        try {
            // 1. 检查补丁是否已应用
            console.log('📋 [WindsurfPatchService] 步骤1: 检查补丁是否已应用');
            if (await this.isPatchApplied()) {
                console.log('✅ [WindsurfPatchService] 补丁已应用，无需重新应用');
                return {
                    needsRestart: false
                };
            }

            console.log('⚠️ [WindsurfPatchService] 补丁未应用，需要应用补丁');

            // 2. 检查权限
            console.log('📋 [WindsurfPatchService] 步骤2: 检查权限');
            const permissionCheck = this.checkWritePermission();
            if (!permissionCheck.hasPermission) {
                console.error('❌ [WindsurfPatchService] 权限检查失败');
                return {
                    needsRestart: false,
                    error: permissionCheck.error || "Insufficient permissions to apply patch. Please check file permissions."
                };
            }

            console.log('✅ [WindsurfPatchService] 权限检查通过');

            // 3. 应用补丁
            console.log('📋 [WindsurfPatchService] 步骤3: 应用补丁');
            const patchResult = await this.applyPatch();
            if (patchResult.success) {
                console.log('🎉 [WindsurfPatchService] 补丁应用成功，需要重启 Windsurf');
                return {
                    needsRestart: true
                };
            } else {
                console.error('❌ [WindsurfPatchService] 补丁应用失败');
                return {
                    needsRestart: false,
                    error: patchResult.error || "应用 Windsurf 补丁失败"
                };
            }

        } catch (error) {
            console.error('❌ [WindsurfPatchService] 补丁检查/应用流程失败:', error);
            return {
                needsRestart: false,
                error: `补丁检查/应用失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }
}
