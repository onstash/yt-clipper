import { useRouter } from "next/router";
import { useCallback } from "react";

interface QueryParams {
  v?: string;      // videoId instead of full URL
  start?: string;
  end?: string;
  jobId?: string;
}

interface UseQueryParamsReturn {
  params: QueryParams;
  updateParams: (newParams: Partial<QueryParams>) => void;
}

/**
 * Custom hook to sync form state with URL query parameters
 */
export function useQueryParams(): UseQueryParamsReturn {
  const router = useRouter();

  // Parse current query params
  const params: QueryParams = {
    v: router.query.v as string | undefined,
    start: router.query.start as string | undefined,
    end: router.query.end as string | undefined,
    jobId: router.query.jobId as string | undefined,
  };

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
  };
}
