import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useT } from "@/i18n";

const NotFound = () => {
  const { t } = useT();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="max-w-sm text-center">
        <p className="mb-2 text-4xl font-bold">404</p>
        <h1 className="mb-2 text-xl font-semibold">{t("nav.notFoundTitle")}</h1>
        <p className="mb-6 text-muted-foreground leading-relaxed">{t("nav.notFoundBody")}</p>
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("nav.homeLink")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
