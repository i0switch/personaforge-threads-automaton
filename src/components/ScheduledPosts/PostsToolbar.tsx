
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, SortAsc, SortDesc, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

export interface PostFilters {
  search: string;
  status: string[];
  personas: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

export interface PostSort {
  field: 'created_at' | 'scheduled_for' | 'content' | 'status';
  direction: 'asc' | 'desc';
}

interface PostsToolbarProps {
  posts: Post[];
  filters: PostFilters;
  sort: PostSort;
  onFiltersChange: (filters: PostFilters) => void;
  onSortChange: (sort: PostSort) => void;
}

export const PostsToolbar = ({
  posts,
  filters,
  sort,
  onFiltersChange,
  onSortChange
}: PostsToolbarProps) => {
  const uniquePersonas = Array.from(
    new Set(posts.map(post => post.personas?.name).filter(Boolean))
  );

  const statusOptions = [
    { value: 'draft', label: '下書き' },
    { value: 'scheduled', label: '予約済み' },
    { value: 'published', label: '公開済み' }
  ];

  const sortOptions = [
    { value: 'created_at', label: '作成日' },
    { value: 'scheduled_for', label: '予約日時' },
    { value: 'content', label: '内容' },
    { value: 'status', label: 'ステータス' }
  ];

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleStatusFilter = (status: string, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, status]
      : filters.status.filter(s => s !== status);
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handlePersonaFilter = (persona: string, checked: boolean) => {
    const newPersonas = checked
      ? [...filters.personas, persona]
      : filters.personas.filter(p => p !== persona);
    onFiltersChange({ ...filters, personas: newPersonas });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: [],
      personas: [],
      dateRange: {}
    });
  };

  const hasActiveFilters = filters.search || filters.status.length > 0 || filters.personas.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="投稿内容やハッシュタグで検索..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                フィルター
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                    {filters.status.length + filters.personas.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">ステータス</h4>
                  <div className="space-y-2">
                    {statusOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${option.value}`}
                          checked={filters.status.includes(option.value)}
                          onCheckedChange={(checked) =>
                            handleStatusFilter(option.value, checked as boolean)
                          }
                        />
                        <label htmlFor={`status-${option.value}`} className="text-sm">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">ペルソナ</h4>
                  <div className="space-y-2">
                    {uniquePersonas.map((persona) => (
                      <div key={persona} className="flex items-center space-x-2">
                        <Checkbox
                          id={`persona-${persona}`}
                          checked={filters.personas.includes(persona!)}
                          onCheckedChange={(checked) =>
                            handlePersonaFilter(persona!, checked as boolean)
                          }
                        />
                        <label htmlFor={`persona-${persona}`} className="text-sm">
                          {persona}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Select
            value={sort.field}
            onValueChange={(field) => onSortChange({ ...sort, field: field as PostSort['field'] })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="並び替え" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          >
            {sort.direction === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
          
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.status.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {statusOptions.find(s => s.value === status)?.label}
              <button
                onClick={() => handleStatusFilter(status, false)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.personas.map((persona) => (
            <Badge key={persona} variant="secondary" className="gap-1">
              {persona}
              <button
                onClick={() => handlePersonaFilter(persona, false)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
