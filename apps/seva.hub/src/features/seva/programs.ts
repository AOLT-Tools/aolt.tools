import type { SevaWorkspaceContext, Lead, Program } from './types';

export function createProgramMethods() {
  return {
    parsePrograms(
      this: SevaWorkspaceContext,
      value: string | string[] | null | undefined
    ): string[] {
      if (!value) {
        return [];
      }
      if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
      }
      return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    },
    refreshProgramCaches(this: SevaWorkspaceContext): void {
      const ordered = this.appConfig.programDisplayOrder || [];
      const map: Record<string, number> = {};
      for (let i = 0; i < ordered.length; i++) {
        map[String(ordered[i]).toUpperCase()] = i;
      }
      this.programOrderMap = map;

      const codeMap: Record<string, string> = {};
      (this.appConfig.programs || []).forEach((program: Program) => {
        const code = String(program.code || '').toUpperCase();
        if (code) {
          codeMap[code] = code;
        }
      });
      this.programCodeMap = codeMap;
    },
    normalizePrograms(
      this: SevaWorkspaceContext,
      value: string | string[] | null | undefined
    ): string[] {
      return this.parsePrograms(value)
        .map((item: string) => {
          const raw = String(item || '')
            .trim()
            .toUpperCase();
          if (!raw) {
            return '';
          }
          return this.programCodeMap[raw] || raw;
        })
        .filter(Boolean)
        .filter(
          (item: string, index: number, arr: string[]) => arr.indexOf(item) === index
        )
        .sort((a: string, b: string) => {
          const ai = Object.prototype.hasOwnProperty.call(this.programOrderMap, a)
            ? this.programOrderMap[a]
            : 999;
          const bi = Object.prototype.hasOwnProperty.call(this.programOrderMap, b)
            ? this.programOrderMap[b]
            : 999;
          return ai - bi || a.localeCompare(b);
        });
    },
    formatPrograms(
      this: SevaWorkspaceContext,
      value: string | string[] | null | undefined,
      prefix: string
    ): string {
      const joined = this.normalizePrograms(value).join('·');
      return joined ? prefix + joined : '';
    },
    buildProgramCatalogFromOrder(
      this: SevaWorkspaceContext,
      displayOrder: string[]
    ): Program[] {
      const seen: Record<string, boolean> = {};
      return (displayOrder || [])
        .map((item: string) =>
          String(item || '')
            .trim()
            .toUpperCase()
        )
        .filter((code: string) => {
          if (!code || seen[code]) {
            return false;
          }
          seen[code] = true;
          return true;
        })
        .map((code: string) => ({ code: code, label: code }));
    },
    inferProgramsFromLeads(this: SevaWorkspaceContext, leads: Lead[]): Program[] {
      const unique: Record<string, boolean> = {};
      (leads || []).forEach((lead: Lead) => {
        this.parsePrograms(lead.wishlistPrograms).forEach((item: string) => {
          const code = String(item || '')
            .trim()
            .toUpperCase();
          if (code) {
            unique[code] = true;
          }
        });
        this.parsePrograms(lead.donePrograms).forEach((item: string) => {
          const code = String(item || '')
            .trim()
            .toUpperCase();
          if (code) {
            unique[code] = true;
          }
        });
      });
      return Object.keys(unique)
        .sort()
        .map((code: string) => ({ code: code, label: code }));
    },
    getProgramListForSave(this: SevaWorkspaceContext, list: string[] | string): string {
      return this.normalizePrograms(list).join(',');
    },
    getProgramSummary(this: SevaWorkspaceContext, lead: Lead): string {
      const wishlist = this.formatPrograms(lead.wishlistPrograms, '🎯');
      const done = this.formatPrograms(lead.donePrograms, '✅');
      if (wishlist && done && this.shouldShowDonePrograms()) {
        return wishlist + ' | ' + done;
      }
      if (wishlist) {
        return wishlist;
      }
      if (done && this.shouldShowDonePrograms()) {
        return done;
      }
      return '✏️ Program';
    },
    refreshLeadProgramSummary(this: SevaWorkspaceContext, lead: Lead): void {
      lead.programSummary = this.getProgramSummary(lead);
    },
    shouldShowProgramEditor(this: SevaWorkspaceContext): boolean {
      return (
        Array.isArray(this.appConfig.programs) && this.appConfig.programs.length > 0
      );
    },
    shouldShowDonePrograms(this: SevaWorkspaceContext): boolean {
      if (
        this.selectedCampaign &&
        typeof this.selectedCampaign.showDonePrograms === 'boolean'
      ) {
        return this.selectedCampaign.showDonePrograms;
      }
      return this.appConfig.showDonePrograms !== false;
    },
    openProgramEditor(this: SevaWorkspaceContext, lead: Lead): void {
      if (!this.shouldShowProgramEditor()) {
        return;
      }
      this.activateCard(lead);
      this.activeProgramLead = lead;
      this.programDraft = {
        wishlist: this.normalizePrograms(lead.wishlistPrograms),
        done: this.normalizePrograms(lead.donePrograms)
      };
      this.isProgramEditorOpen = true;
    },
    closeProgramEditor(this: SevaWorkspaceContext): void {
      this.isProgramEditorOpen = false;
      this.activeProgramLead = null;
      this.programDraft = { wishlist: [], done: [] };
    },
    applyProgramEditor(this: SevaWorkspaceContext): void {
      if (!this.activeProgramLead) {
        this.closeProgramEditor();
        return;
      }
      const lead = this.activeProgramLead;
      lead.wishlistPrograms = this.normalizePrograms(this.programDraft.wishlist);
      if (this.shouldShowDonePrograms()) {
        lead.donePrograms = this.normalizePrograms(this.programDraft.done);
      }
      this.refreshLeadProgramSummary(lead);
      this.markLeadDirty(lead);
      this.closeProgramEditor();
    },
    isProgramSelected(
      this: SevaWorkspaceContext,
      type: 'done' | 'wishlist',
      code: string
    ): boolean {
      const target =
        type === 'done' ? this.programDraft.done : this.programDraft.wishlist;
      const normalized =
        this.normalizePrograms([code])[0] || String(code || '').toUpperCase();
      return target.includes(normalized);
    },
    toggleProgramSelection(
      this: SevaWorkspaceContext,
      type: 'done' | 'wishlist',
      code: string
    ): void {
      const normalized =
        this.normalizePrograms([code])[0] || String(code || '').toUpperCase();
      const key = type === 'done' ? 'done' : 'wishlist';
      const list = this.programDraft[key] || [];
      if (list.includes(normalized)) {
        this.programDraft[key] = list.filter((item) => item !== normalized);
        return;
      }
      this.programDraft[key] = this.normalizePrograms([...list, normalized]);
    }
  };
}
