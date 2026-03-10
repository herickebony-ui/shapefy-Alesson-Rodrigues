import React from "react";

const ButtonPrimary = ({ 
  children, 
  onClick, 
  isLoading = false, 
  type = "button", 
  className = "",
  ...props 
}) => {
  return (
    <button
      type={type}
      onClick={!isLoading ? onClick : undefined}
      className={`
        bg-ebony-primary hover:bg-red-900 text-white font-medium 
        py-2.5 px-4 rounded-lg transition-all duration-300
        shadow-lg shadow-red-900/20 active:scale-95
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processando...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default ButtonPrimary;