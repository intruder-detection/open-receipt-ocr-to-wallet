import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreateWalletRecordDto } from './dto/create-wallet-record.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Get Wallet accounts from BudgetBakers' })
  getAccounts() {
    return this.walletService.getAccounts();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get Wallet categories from BudgetBakers' })
  getCategories() {
    return this.walletService.getCategories();
  }

  @Post('records')
  @ApiOperation({ summary: 'Create a new record in Wallet by BudgetBakers' })
  createRecord(@Body() createWalletRecordDto: CreateWalletRecordDto) {
    return this.walletService.createRecord(createWalletRecordDto);
  }
}
