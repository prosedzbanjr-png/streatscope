import type { ReactNode } from "react";
import "../auction-access.css";
import WinnerBanner from "./winner-banner";

export default function VehicleLayout({children}:{children:ReactNode}){
  return <><WinnerBanner/>{children}</>;
}
