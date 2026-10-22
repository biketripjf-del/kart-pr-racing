// Foto de piloto por IA (22/10/2026, Brunner: "o píloto joga a foto dele e transformamos nele vestido de piloto").
// Selfie + referência do macacão (SEM rosto: com rosto na referência o modelo mistura as identidades — medido
// 22/10) → retrato de estúdio com o macacão na cor escolhida. Modelo e régua validados com a foto do Brunner.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELO = 'gemini-3-pro-image-preview';
const REFERENCIA = fs.readFileSync(path.join(__dirname, '../assets/macacao-referencia.jpg')).toString('base64');

// a ordem é a da tela; a 1ª é a cor da P&R
export const CORES = {
  azul: { nome: 'Azul P&R', prompt: 'royal blue (#055391) and white' },
  laranja: { nome: 'Laranja', prompt: 'orange and black' },
  vermelho: { nome: 'Vermelho', prompt: 'red and black' },
  preto: { nome: 'Preto', prompt: 'black and white' },
  verde: { nome: 'Verde', prompt: 'green and black' },
  amarelo: { nome: 'Amarelo', prompt: 'yellow and black' },
};

const prompt = (cor) =>
  'Image 1 is a photo of a real person. Image 2 shows ONLY a kart racing suit design (no person\'s face). ' +
  'Create a professional studio portrait of THE PERSON FROM IMAGE 1. Identity is the top priority: keep their exact face, ' +
  'face shape, eyes, nose, mouth, expression, skin tone, hairline, hair and facial hair EXACTLY as in image 1 — do not ' +
  'change the beard, do not change their age. They wear a kart racing suit with the same cut and panel design as image 2, ' +
  `but in ${cor}, and a plain cap in the same colors (no logo). Black racing gloves, hands on hips, waist-up framing, ` +
  'centered, dark grey studio backdrop, soft professional lighting, photorealistic. No logos, no text, no sponsor patches anywhere.';

export const fotoIAAtiva = () => !!process.env.GEMINI_API_KEY;

// selfie = data URL de imagem; devolve data URL do retrato, ou lança Error com .codigo
export async function gerarFotoPiloto(selfie, cor) {
  const [, mime, dados] = selfie.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/) || [];
  const corpo = {
    contents: [{ parts: [
      { inline_data: { mime_type: mime, data: dados } },
      { inline_data: { mime_type: 'image/jpeg', data: REFERENCIA } },
      { text: prompt(CORES[cor].prompt) },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
  };
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    throw Object.assign(new Error(`ia_fora: ${e.name}`), { codigo: 'ia_fora' });
  }
  if (!r.ok) {
    // o corpo de erro do Google não carrega a chave; só o status e o começo da mensagem vão pro log
    const txt = (await r.text().catch(() => '')).slice(0, 200);
    throw Object.assign(new Error(`ia_http_${r.status}: ${txt}`), { codigo: 'ia_fora' });
  }
  const j = await r.json();
  for (const c of j.candidates || []) {
    for (const p of c.content?.parts || []) {
      const d = p.inlineData || p.inline_data;
      if (d?.data) return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
    }
  }
  // sem imagem = o modelo recusou (foto sem rosto, conteúdo bloqueado)
  throw Object.assign(new Error(`ia_sem_imagem: ${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || '?'}`), { codigo: 'ia_recusou' });
}
