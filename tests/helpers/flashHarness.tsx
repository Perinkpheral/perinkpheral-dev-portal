// SPDX-License-Identifier: MIT
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from '../../src/App'
import { LangProvider } from '../../src/i18n'

const router = createBrowserRouter([
  { path: '*', element: <LangProvider><App /></LangProvider> },
])
const root = createRoot(document.getElementById('root')!)
// Exercise cleanup even when something outside the router removes the page.
Object.assign(window, { unmountFlash: () => root.unmount() })
root.render(<StrictMode><RouterProvider router={router} /></StrictMode>)
