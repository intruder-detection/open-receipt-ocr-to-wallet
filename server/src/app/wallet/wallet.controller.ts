import { Controller, Get, Post, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreateWalletRecordDto } from './dto/create-wallet-record.dto';
import { UpdateWalletRecordDto } from './dto/update-wallet-record.dto';

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

  @Patch('records')
  @ApiOperation({ summary: 'Update an existing record in Wallet by BudgetBakers' })
  updateRecord(@Body() updateWalletRecordDto: UpdateWalletRecordDto) {
    return this.walletService.updateRecord(updateWalletRecordDto);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get Wallet OCR configuration' })
  getConfig() {
    return this.walletService.getConfig();
  }
}
