import type { WhatsAppEvent } from '@aolt/integrations/whatsapp/cloud';

export type WhatsAppPlugin = (
  event: WhatsAppEvent
) => Promise<readonly string[]> | readonly string[];

export const exampleWhatsAppPlugin: WhatsAppPlugin = async (event) => {
  if (event.kind === 'text' && event.text.toLowerCase() === 'help') {
    return [
      'The Alpine Vercel App Kit webhook is connected. Replace examples/whatsapp-plugin.tsx with your domain workflow.'
    ];
  }
  return [];
};
