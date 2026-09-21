export type Product={id:string;name:string;slug:string;description:string;price_cents:number;image_url:string;category:string;active:boolean;featured:boolean;inventory_count:number|null;sort_order:number};
export type StoreSettings={store_name:string;phone:string;email:string;address:string;hours:string;announcement:string;accepting_orders:boolean;pickup_enabled:boolean;delivery_enabled:boolean;delivery_fee_cents:number;payment_provider:"none"|"square"|"stripe"};
export type CartItem={product:Product;quantity:number};
export type Order={id:string;order_number:string;customer_name:string;customer_email:string;customer_phone:string;fulfillment_type:string;status:string;payment_status:string;total_cents:number;created_at:string};
