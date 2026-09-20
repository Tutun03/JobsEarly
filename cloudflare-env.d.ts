interface __BaseEnv_CloudflareEnv {
  jobsearly_db: D1Database;
  IMAGES: ImagesBinding;
  ASSETS: Fetcher;
  NEXTJS_ENV: string;
  WORKER_SELF_REFERENCE: Service<
    typeof import("./.open-next/worker").default
  >;
}

declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./.open-next/worker");
  }

  interface Env extends __BaseEnv_CloudflareEnv {}
}

interface CloudflareEnv extends __BaseEnv_CloudflareEnv {}

type StringifyValues<EnvType extends Record<string, unknown>> = {
  [Binding in keyof EnvType]: EnvType[Binding] extends string
    ? EnvType[Binding]
    : string;
};

declare namespace NodeJS {
  interface ProcessEnv
    extends StringifyValues<Pick<Cloudflare.Env, "NEXTJS_ENV">> {}
}