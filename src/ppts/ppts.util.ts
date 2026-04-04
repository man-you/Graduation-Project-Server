import * as crypto from 'crypto';

/**
 * 讯飞API鉴权工具类
 * 用于生成讯飞智文API所需的签名
 */
export class PPTsAuthUtil {
  /**
   * 获取签名
   * @param appId 应用ID
   * @param secret 应用秘钥
   * @param timestamp 时间戳（秒）
   * @returns 签名字符串
   */
  static getSignature(
    appId: string,
    secret: string,
    timestamp: number,
  ): string {
    try {
      const auth = this.md5(`${appId}${timestamp}`);
      return this.hmacSHA1Encrypt(auth, secret);
    } catch (error) {
      console.error('生成签名失败:', error);
      return null;
    }
  }

  /**
   * SHA1加密
   * @param encryptText 加密文本
   * @param encryptKey 加密键
   * @returns 加密后的Base64字符串
   */
  private static hmacSHA1Encrypt(
    encryptText: string,
    encryptKey: string,
  ): string {
    try {
      const hmac = crypto.createHmac('sha1', encryptKey);
      hmac.update(encryptText, 'utf8');
      const rawHmac = hmac.digest();
      return rawHmac.toString('base64');
    } catch (error) {
      throw new Error(`SHA1加密失败: ${error.message}`);
    }
  }

  /**
   * MD5加密
   * @param cipherText 要加密的文本
   * @returns MD5十六进制字符串
   */
  private static md5(cipherText: string): string {
    try {
      const hash = crypto.createHash('md5');
      hash.update(cipherText, 'utf8');
      return hash.digest('hex');
    } catch (error) {
      console.error('MD5加密失败:', error);
      return null;
    }
  }
}
