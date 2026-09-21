import { useEffect,useState } from "react";
import { Storefront } from "./Storefront";
import { Admin } from "./Admin";
export function App(){
 const [path,setPath]=useState(location.pathname);
 useEffect(()=>{const onPop=()=>setPath(location.pathname);addEventListener("popstate",onPop);return()=>removeEventListener("popstate",onPop)},[]);
 const navigate=(to:string)=>{history.pushState({},"",to);setPath(to);scrollTo(0,0)};
 return path.startsWith("/admin")?<Admin navigate={navigate}/>:<Storefront navigate={navigate}/>;
}
