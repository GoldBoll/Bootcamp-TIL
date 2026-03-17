#pragma once
#include <iostream>
#include <string>
using namespace std;
class Player;
class Monster {
public:
    Monster(string name);
    void attack(Player* player);
    string getName(); int getHP(); int getPower(); int getDefence(); int getSpeed();
    void setName(string name); void setHP(int HP); void setPower(int power);
    void setDefence(int defence); void setSpeed(int speed);
protected:
    string name;
    int HP, power, defence, speed;
};
