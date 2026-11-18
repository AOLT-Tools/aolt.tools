import Alpine from '@alpinejs/csp';
import { appRuntime } from './services/appRuntime';
import {
  ArrowDownUp,
  BookOpenText,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Download,
  EllipsisVertical,
  ExternalLink,
  FolderInput,
  LayoutGrid,
  NotebookText,
  Paperclip,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  StickyNote,
  Table2,
  Trash2,
  TriangleAlert,
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
      ArrowDownUp,
      BookOpenText,
      Calendar,
      CalendarCheck,
      CalendarClock,
      Download,
      EllipsisVertical,
      ExternalLink,
      FolderInput,
      LayoutGrid,
      NotebookText,
      Paperclip,
      Pencil,
      Phone,
      PhoneCall,
      Plus,
      Power,
      RefreshCw,
      Search,
      SlidersHorizontal,
      Star,
      StickyNote,
      Table2,
      Trash2,
      TriangleAlert,
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
