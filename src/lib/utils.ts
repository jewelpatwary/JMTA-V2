import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number, currency: string = "MYR") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const dateFormat = localStorage.getItem('rf_date_format') || 'DD-MM-YYYY';
  
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();

  if (dateFormat === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  } else if (dateFormat === 'MM-DD-YYYY') {
    return `${m}-${d}-${y}`;
  } else {
    // Default DD-MM-YYYY
    return `${d}-${m}-${y.toString().slice(-2)}`;
  }
};
