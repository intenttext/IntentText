import { getTemplateBySlug } from "@/lib/templates";
import TemplateDetail from "@/components/TemplateDetail";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export default async function TemplatePage({
  params,
}: {
  params: { slug: string };
}) {
  const template = await getTemplateBySlug(params.slug);
  if (!template) notFound();

  return <TemplateDetail template={JSON.parse(JSON.stringify(template))} />;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const template = await getTemplateBySlug(params.slug);
  if (!template) return {};
  return {
    title: `${template.name} — IntentText Hub`,
    description: template.description,
  };
}
