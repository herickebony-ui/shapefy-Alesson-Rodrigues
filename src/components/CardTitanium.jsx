import React from "react";

const CardTitanium = ({ children, title, action, className = "" }) => {
  return (
    <div className={`bg-ebony-surface rounded-xl border border-ebony-border shadow-lg overflow-hidden ${className}`}>
      {/* Se tiver Título ou Ação, mostra o cabeçalho */}
      {(title || action) && (
        <div className="px-6 py-4 border-b border-ebony-border flex justify-between items-center bg-ebony-surface/50">
          {title && (
            <h3 className="text-lg font-bold text-white tracking-tight">
              {title}
            </h3>
          )}
          {action && (
            <div>
              {action}
            </div>
          )}
        </div>
      )}
      
      {/* O Conteúdo do Card */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default CardTitanium;