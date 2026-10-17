/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as vendorNewOrder } from './vendor-new-order.tsx'
import { template as sellerApproved } from './seller-approved.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-confirmation': orderConfirmation,
  'vendor-new-order': vendorNewOrder,
  'seller-approved': sellerApproved,
}
