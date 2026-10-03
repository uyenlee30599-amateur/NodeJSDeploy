import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();
