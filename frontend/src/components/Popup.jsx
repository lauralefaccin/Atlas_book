import React, { useState } from "react";
import alertIcon from "../imagens/icons/alerta.png";

export default function Popup({ visible, message, onClose, onConfirm, type = "info" }) {
  const [hoverCancel, setHoverCancel] = useState(false);
  const [hoverConfirm, setHoverConfirm] = useState(false);

  if (!visible) return null;

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    zIndex: 9999,
    padding: 20,
    background: "rgba(0, 0, 0, 0.28)",
  };

  const boxStyle = {
    position: "relative",
    background: "#ffffff",
    color: "#111111",
    padding: "28px 30px 24px",
    borderRadius: 18,
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.25)",
    maxWidth: 540,
    width: "min(540px, 100%)",
    textAlign: "center",
    fontSize: 17,
    border: "1px solid #e6e6e6",
  };

  const closeBtnStyle = {
    position: "absolute",
    top: 14,
    right: 14,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    zIndex: 10000,
    pointerEvents: "auto",
    color: "#111111",
  };

  const actionButtonStyle = {
    border: "none",
    borderRadius: "999px",
    padding: "11px 22px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    minWidth: 110,
  };

  const confirmButtonStyle = {
    ...actionButtonStyle,
    background: hoverConfirm ? "#d9a900" : "#f1c40f",
    color: "#111111",
    transition: "background 0.2s ease, transform 0.2s ease",
  };

  const cancelButtonStyle = {
    ...actionButtonStyle,
    background: hoverCancel ? "#d9a900" : "#f1c40f",
    color: "#111111",
    transition: "background 0.2s ease, transform 0.2s ease",
  };

  const okButtonStyle = {
    ...actionButtonStyle,
    background: "#f1c40f",
    color: "#111111",
    transition: "background 0.2s ease, transform 0.2s ease",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 18,
  };

  const iconStyle = {
    width: 42,
    height: 42,
    objectFit: "contain",
  };

  const titleStyle = {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#c89c00",
    letterSpacing: 0.4,
  };

  const messageStyle = {
    margin: 0,
    lineHeight: 1.5,
    color: "#111111",
  };

  const buttonWrapperStyle = {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginTop: 22,
    flexWrap: "wrap",
  };

  return (
    <div style={backdropStyle} aria-live="polite" onClick={onClose}>
      <div style={boxStyle} role={type === "confirm" ? "alertdialog" : "dialog"} onClick={(event) => event.stopPropagation()}>
        <button aria-label="Fechar" onClick={onClose} style={closeBtnStyle}>✕</button>
        <div style={headerStyle}>
          <img src={alertIcon} alt="Alerta" style={iconStyle} />
          <h2 style={titleStyle}>Atenção</h2>
        </div>
        <p style={messageStyle}>{message}</p>
        {type === "confirm" && (
          <div style={buttonWrapperStyle}>
            <button 
              type="button" 
              onClick={onClose} 
              style={cancelButtonStyle}
              onMouseEnter={() => setHoverCancel(true)}
              onMouseLeave={() => setHoverCancel(false)}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={onConfirm} 
              style={confirmButtonStyle}
              onMouseEnter={() => setHoverConfirm(true)}
              onMouseLeave={() => setHoverConfirm(false)}
            >
              OK
            </button>
          </div>
        )}
        {type !== "confirm" && (
          <div style={buttonWrapperStyle}>
            <button type="button" onClick={onClose} style={okButtonStyle}>
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
