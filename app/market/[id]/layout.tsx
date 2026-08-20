import type { ReactNode } from "react";
import "../auction-access.css";
import "../auction-winner.css";
import "../listed-by.css";
import ListedBy from "./listed-by";
import RealtimeAuctionSync from "./realtime-auction-sync";

export default function VehicleLayout({children}:{children:ReactNode}){
  return <>{children}<RealtimeAuctionSync/><ListedBy/></>;
}
