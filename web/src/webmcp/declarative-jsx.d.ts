/**
 * Declarative WebMCP form attributes (Chrome origin trial). Chrome synthesizes a tool from a
 * `<form toolname toolautosubmit>` and fills fields annotated with `toolparamdescription`.
 * Typed here so product components can use them without `any`.
 */
import "react";

declare module "react" {
  interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: string | boolean;
  }
  interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
    toolparamdescription?: string;
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    toolparamdescription?: string;
  }
}
