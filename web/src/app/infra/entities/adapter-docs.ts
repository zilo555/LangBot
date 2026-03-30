/**
 * Returns the documentation URL for a given adapter name,
 * using link.langbot.app short links.
 */
export function getAdapterDocUrl(
  adapterName: string,
  locale: string,
): string | null {
  // Map locale to doc language prefix
  let lang: string;
  if (locale.startsWith('zh')) {
    lang = 'zh';
  } else if (locale.startsWith('ja')) {
    lang = 'ja';
  } else {
    lang = 'en';
  }

  // Only adapters with dedicated doc pages
  const ADAPTER_DOC_SLUGS: Record<string, string> = {
    telegram: 'telegram',
    discord: 'discord',
    slack: 'slack',
    line: 'line',
    kook: 'kook',
    lark: 'lark',
    dingtalk: 'dingtalk',
    aiocqhttp: 'aiocqhttp',
    qqofficial: 'qqofficial',
    wecom: 'wecom',
    wecomcs: 'wecomcs',
    wecombot: 'wecombot',
    officialaccount: 'officialaccount',
    wechatpad: 'wechatpad',
    openclaw_weixin: 'openclaw_weixin',
    satori: 'satori',
  };

  const slug = ADAPTER_DOC_SLUGS[adapterName];
  if (!slug) return null;

  return `https://link.langbot.app/${lang}/platforms/${slug}`;
}
