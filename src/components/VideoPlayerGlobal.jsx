import React from 'react';
import { ExternalLink } from 'lucide-react';

// ✅ NOVO COMPONENTE GLOBAL: Player de Vídeo Inteligente (Corrigido com playsinline)
const VideoPlayerGlobal = ({ url }) => {
    if (!url) return null;
    const cleanUrl = url.trim();
  
    // 1. YouTube (Suporta links curtos, longos e embeds)
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return (
        <iframe
          className="w-full h-full"
          // ADICIONADO: playsinline=1 força o vídeo a ficar na página
          src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0&playsinline=1`}
          title="YouTube video"
          frameBorder="0"
          // ADICIONADO: Atributo playsInline para compatibilidade mobile
          playsInline
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
  
    // 2. Vimeo
    const vimeoMatch = cleanUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return (
        <iframe
          className="w-full h-full"
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          title="Vimeo video"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
  
    // 3. Vídeo Direto (.mp4, .webm, etc)
    if (cleanUrl.match(/\.(mp4|webm|ogg)$/i)) {
      return (
        <video className="w-full h-full" controls playsInline>
          <source src={cleanUrl} />
          Seu navegador não suporta este vídeo.
        </video>
      );
    }
  
    // 4. Fallback (Se não for vídeo reconhecido, mostra link)
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        <a href={cleanUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
          <ExternalLink className="w-4 h-4" /> Abrir Link do Vídeo
        </a>
      </div>
    );
  };

  export default VideoPlayerGlobal;