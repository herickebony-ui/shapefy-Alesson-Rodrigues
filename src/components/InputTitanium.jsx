import React from "react";

const InputTitanium = ({ 
  label, 
  value, 
  onChange, 
  placeholder = "", 
  type = "text", 
  icon: Icon, // Se quiser passar um ícone do Lucide depois
  ...props 
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
          {label}
        </label>
      )}
      
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-ebony-primary transition-colors">
            <Icon size={16} />
          </div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            w-full bg-[#1a1a1a] text-white text-sm p-3 rounded-lg outline-none 
            border border-ebony-border 
            placeholder-gray-600 transition-all duration-300
            focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary/50
            ${Icon ? "pl-10" : ""}
          `}
          {...props}
        />
      </div>
    </div>
  );
};

export default InputTitanium;