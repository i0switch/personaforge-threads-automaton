
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DateTimeSelectorProps {
  selectedDates: string[];
  selectedTimes: string[];
  onDatesChange: (dates: string[]) => void;
  onTimesChange: (times: string[]) => void;
}

export const DateTimeSelector = ({ 
  selectedDates, 
  selectedTimes, 
  onDatesChange, 
  onTimesChange 
}: DateTimeSelectorProps) => {
  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i + 1);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'M月d日(E)', { locale: ja })
    };
  });

  // Common posting times
  const times = [
    { value: '08:00', label: '朝 8:00' },
    { value: '12:00', label: '昼 12:00' },
    { value: '18:00', label: '夕 18:00' },
    { value: '21:00', label: '夜 21:00' }
  ];

  const handleDateChange = (dateValue: string, checked: boolean) => {
    if (checked) {
      onDatesChange([...selectedDates, dateValue]);
    } else {
      onDatesChange(selectedDates.filter(d => d !== dateValue));
    }
  };

  const handleTimeChange = (timeValue: string, checked: boolean) => {
    if (checked) {
      onTimesChange([...selectedTimes, timeValue]);
    } else {
      onTimesChange(selectedTimes.filter(t => t !== timeValue));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>投稿日時を選択</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">日付</h4>
          <div className="grid grid-cols-2 gap-3">
            {dates.map((date) => (
              <div key={date.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`date-${date.value}`}
                  checked={selectedDates.includes(date.value)}
                  onCheckedChange={(checked) => handleDateChange(date.value, checked as boolean)}
                />
                <label htmlFor={`date-${date.value}`} className="text-sm">
                  {date.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">時刻</h4>
          <div className="grid grid-cols-2 gap-3">
            {times.map((time) => (
              <div key={time.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`time-${time.value}`}
                  checked={selectedTimes.includes(time.value)}
                  onCheckedChange={(checked) => handleTimeChange(time.value, checked as boolean)}
                />
                <label htmlFor={`time-${time.value}`} className="text-sm">
                  {time.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
