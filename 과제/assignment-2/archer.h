#pragma once
#include "player.h"
class Archer : public Player {
public:
    Archer(string nickname);
    void attack() override;
    void attack(Monster* monster) override;
};
