export const CONTACT_CHANNELS = [
  {
    id: "messenger",
    label: "Messenger",
    handle: "knguyen2404",
    href: "https://m.me/knguyen2404",
  },
  {
    id: "zalo",
    label: "Zalo",
    handle: "0974 322 365",
    href: "https://zalo.me/0974322365",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    handle: "khiemnd777",
    href: "https://wa.me/khiemnd777",
  },
  {
    id: "telegram",
    label: "Telegram",
    handle: "iamkhiem",
    href: "https://t.me/iamkhiem",
  },
  {
    id: "viber",
    label: "Viber",
    handle: "0974 322 365",
    href: "viber://chat?number=%2B84974322365",
  },
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
