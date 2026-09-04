import Alpine from '@alpinejs/csp';
import { appRuntime } from './services/appRuntime';
import {
  Calendar,
  Download,
  ExternalLink,
  FolderInput,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  UserRoundPlus,
  Users,
  X,
  createIcons
} from 'lucide';
import './main.css';

declare global {
  interface Window {
    appRuntime: typeof appRuntime;
    Alpine: typeof Alpine;
  }
}

window.appRuntime = appRuntime;
window.Alpine = Alpine;

async function bootstrap() {
  const { sevaWorkspace } = await import('./features/seva/sevaWorkspace');
  Alpine.data('sevaWorkspace', sevaWorkspace);
  createIcons({
    icons: {
      Calendar,
      Download,
      ExternalLink,
      FolderInput,
      Paperclip,
      Pencil,
      Phone,
      Plus,
      Power,
      RefreshCw,
      Search,
      SlidersHorizontal,
      Trash2,
      UserCheck,
      UserCog,
      UserPlus,
      UserRoundPlus,
      Users,
      X
    },
    inTemplates: true
  });
  Alpine.start();
}

void bootstrap();
