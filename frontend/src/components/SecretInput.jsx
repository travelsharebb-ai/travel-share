import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "../lib/i18n";

export default function SecretInput({ kind = "password", className = "field", wrapperClassName = "", ...inputProps }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const isPin = kind === "pin";
  const toggleLabel = visible
    ? (isPin ? t("security.hidePinValue") : t("authPage.hidePassword"))
    : (isPin ? t("security.showPinValue") : t("authPage.showPassword"));

  return (
    <div className={`relative min-w-0 w-full ${wrapperClassName}`.trim()}>
      <input {...inputProps} type={visible ? "text" : "password"} className={`${className} w-full pr-12`.trim()} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slatebody transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary"
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </button>
    </div>
  );
}
