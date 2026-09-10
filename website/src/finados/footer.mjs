const campaignAssetVersion = '20260903';

export function renderFinadosFooter() {
  return `<footer class="bg-night px-4 py-12 text-lienzo">
    <div class="mx-auto flex w-[min(100%,88rem)] flex-col gap-8 border-t border-lienzo/30 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <img class="h-auto w-36" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026">
        <p class="mt-4 max-w-md text-sm leading-relaxed text-lienzo/60">Información de Finados 2026. Consulta condiciones, disponibilidad y novedades por los canales oficiales.</p>
      </div>
      <a class="footer-link" href="/">Volver a complejomushucruna.com <span aria-hidden="true">↗</span></a>
    </div>
  </footer>`;
}
