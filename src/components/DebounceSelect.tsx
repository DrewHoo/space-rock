import { debounce } from "es-toolkit";
import { useMemo, useRef, useState } from "react";
import { Select, Spin } from "antd";
import type { SelectProps } from "antd";

export interface DebounceSelectOption {
  label: React.ReactNode;
  value: string | number;
}

export interface DebounceSelectProps
  extends Omit<SelectProps, "options" | "children"> {
  fetchOptions: (search: string) => Promise<DebounceSelectOption[]>;
  debounceTimeout?: number;
}

export function DebounceSelect({
  fetchOptions,
  debounceTimeout = 300,
  ...props
}: DebounceSelectProps) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<DebounceSelectOption[]>([]);
  const fetchRef = useRef(0);

  const debounceFetcher = useMemo(() => {
    const loadOptions = (value: string) => {
      fetchRef.current += 1;
      const fetchId = fetchRef.current;
      setOptions([]);
      setFetching(true);

      fetchOptions(value).then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          return;
        }
        setOptions(newOptions);
        setFetching(false);
      });
    };

    return debounce(loadOptions, debounceTimeout);
  }, [fetchOptions, debounceTimeout]);

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={debounceFetcher}
      notFoundContent={fetching ? <Spin size="small" /> : "No results found"}
      {...props}
      options={options}
    />
  );
}
