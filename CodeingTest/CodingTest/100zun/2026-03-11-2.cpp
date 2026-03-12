#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main()
{
  vector<int> nums(9);
  
  for (size_t i = 0; i < nums.size(); i++)
  {
    cin >> nums[i];
  }
  
  int idx = max_element(nums.begin(), nums.end())- nums.begin();

  cout << nums[idx] <<endl;
  cout << idx + 1 <<endl;
  return 0;
}