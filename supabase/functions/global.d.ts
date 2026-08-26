declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export * from "@supabase/supabase-js";
}

declare module "https://*" {
  const content: any;
  export default content;
  export const createClient: any;
}

