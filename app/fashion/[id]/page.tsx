import { FeatureDetail } from "../../culture/feature-detail";
export default function FashionDetail({params}:{params:Promise<{id:string}>}){return <FeatureDetail kind="fashion" params={params}/>;}
