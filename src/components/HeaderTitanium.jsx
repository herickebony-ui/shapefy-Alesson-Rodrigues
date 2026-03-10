import React from "react";

const HeaderTitanium = ({ title, subtitle, rightAction }) => {
  return (
    <header className="w-full h-20 bg-ebony-surface border-b border-ebony-border flex items-center justify-between px-8 sticky top-0 z-10">
      {/* Lado Esquerdo: Títulos */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {title || "Ebony System"}
        </h1>
        {subtitle && (
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      {/* Lado Direito: Ações (Perfil, Notificações, Botão Sair) */}
      <div className="flex items-center gap-4">
        {rightAction}
        
        {/* Exemplo de Avatar/Perfil estático por enquanto */}
        <div className="flex items-center gap-3 pl-4 border-l border-ebony-border">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-white">Hérick Ébony</p>
            <p className="text-xs text-gray-500">Administrador</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-ebony-primary flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/20">
            HE
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderTitanium;