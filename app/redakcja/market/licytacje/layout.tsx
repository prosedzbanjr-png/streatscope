import type { ReactNode } from "react";
import "../auction-access-admin.css";
import AuctionPanelEnhancer from "./auction-panel-enhancer";

export default function AuctionAdminLayout({children}:{children:ReactNode}){
  return <><AuctionPanelEnhancer/>{children}</>;
}
