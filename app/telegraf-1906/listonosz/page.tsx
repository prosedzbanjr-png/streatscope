import type { Metadata } from "next";
import { CourierLedger } from "./courier-ledger";
import "./ledger.css";

export const metadata: Metadata = {
  title: "Kancelaria Listonosza",
  description: "Prywatny rejestr organizacji.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ListonoszPage() {
  return <CourierLedger />;
}
