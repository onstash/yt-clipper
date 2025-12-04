import { useRouter } from "next/router";
import { useEffect, useCallback } from "react";
import { inputSchema } from "@/lib/validation";

interface QueryParams {
  url?: string;
  start?: string;
  end?: string;
  jobId?: string;
}

interface UseQueryParamsReturn {
  params: QueryParams;
  updateParams: (newParams: Partial<QueryParams>) => void;
  isValid: boolean;
  validationError: string | null;
}

/**
 * Custom hook to sync form state with URL query parameters
 */
export function useQueryParams(): UseQueryParamsReturn {
  const router = useRouter();

  // Parse current query params
  const params: QueryParams = {
    url: router.query.url as string | undefined,
    start: router.query.start as string | undefined,
    end: router.query.end as string | undefined,
    jobId: router.query.jobId as string | undefined,
  };

  // Validate params (excluding jobId)
  const validateParams = useCallback(() => {
    if (!params.url && !params.start && !params.end) {
      return { isValid: true, error: null }; // Empty is valid
    }

    if (!params.url || !params.start || !params.end) {
      return { isValid: false, error: "All fields are required" };
    }

    const result = inputSchema.safeParse({
      url: params.url,
      start: params.start,
      end: params.end,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      return { isValid: false, error: firstError.message };
    }

    return { isValid: true, error: null };
  }, [params.url, params.start, params.end]);

  const validation = validateParams();

  // Update query params without page reload
  const updateParams = useCallback(
    (newParams: Partial<QueryParams>) => {
      const updatedQuery: Record<string, any> = {
        ...router.query,
        ...newParams,
      };

      // Remove undefined values
      Object.keys(updatedQuery).forEach((key) => {
        if (updatedQuery[key] === undefined || updatedQuery[key] === "") {
          delete updatedQuery[key];
        }
      });

      router.replace(
        {
          pathname: router.pathname,
          query: updatedQuery,
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  return {
    params,
    updateParams,
    isValid: validation.isValid,
    validationError: validation.error,
  };
}
