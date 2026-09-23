import { baseApi } from "../baseApi";
import type { PublicFormField } from "@/components/publicForm/FormFields";

/** The column types a public form can offer — mirrors backend/models/Form.ts
 *  PUBLIC_FORM_FIELD_TYPES. person/people/file/relation/reference are out. */
export const PUBLIC_FORM_FIELD_TYPES = [
    "text",
    "number",
    "status",
    "date",
    "timeline",
    "email",
    "phone",
    "checkbox",
    "dropdown",
    "link",
    "rating",
] as const;

export type FormTheme = "minimal" | "classic" | "bold";

export interface FormFieldConfig {
    column: string;
    label: string;
    required: boolean;
    position: number;
}

export interface FormConfig {
    _id: string;
    workspace: string;
    module: string;
    targetCollection: string;
    publicId: string;
    title: string;
    description: string;
    submitLabel: string;
    fields: FormFieldConfig[];
    theme: FormTheme;
    successTitle: string;
    successBody: string;
    showSignupCta: boolean;
    isPublished: boolean;
    submissionCount: number;
    createdAt: string;
    updatedAt: string;
}

/** What the builder sends on save — everything editable, nothing derived. */
export interface FormConfigInput {
    targetCollection?: string;
    title?: string;
    description?: string;
    submitLabel?: string;
    fields?: { column: string; label: string; required: boolean }[];
    theme?: FormTheme;
    successTitle?: string;
    successBody?: string;
    showSignupCta?: boolean;
    isPublished?: boolean;
}

export const formsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getForm: build.query<{ form: FormConfig | null }, string>({
            query: (moduleId) => `/forms/${moduleId}`,
            providesTags: (_r, _e, moduleId) => [{ type: "Form", id: moduleId }],
        }),

        updateForm: build.mutation<
            { form: FormConfig },
            { moduleId: string; body: FormConfigInput }
        >({
            query: ({ moduleId, body }) => ({
                url: `/forms/${moduleId}`,
                method: "PUT",
                body,
            }),
            invalidatesTags: (_r, _e, { moduleId }) => [{ type: "Form", id: moduleId }],
        }),

        resetFormLink: build.mutation<{ form: FormConfig }, string>({
            query: (moduleId) => ({ url: `/forms/${moduleId}/reset-link`, method: "POST" }),
            invalidatesTags: (_r, _e, moduleId) => [{ type: "Form", id: moduleId }],
        }),

        // ── public, unauthenticated (the route ignores the Bearer header) ──
        getPublicForm: build.query<{ form: PublicFormRenderConfig }, string>({
            query: (publicId) => `/public/forms/${publicId}`,
        }),

        submitPublicForm: build.mutation<
            { ok: boolean },
            { publicId: string; body: Record<string, unknown> }
        >({
            query: ({ publicId, body }) => ({
                url: `/public/forms/${publicId}/submit`,
                method: "POST",
                body,
            }),
        }),
    }),
});

export interface PublicFormRenderConfig {
    title: string;
    description: string;
    submitLabel: string;
    theme: FormTheme;
    successTitle: string;
    successBody: string;
    showSignupCta: boolean;
    fields: PublicFormField[];
}

export const {
    useGetFormQuery,
    useUpdateFormMutation,
    useResetFormLinkMutation,
    useGetPublicFormQuery,
    useSubmitPublicFormMutation,
} = formsApi;
